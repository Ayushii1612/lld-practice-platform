const test = require("node:test");
const assert = require("node:assert/strict");
const { BrowserAttemptStore, EmptySubmissionError, PracticeService } = require("../src/practice-service.js");
const { FeedbackEvaluator } = require("../src/evaluator.js");

const problems = [{ id: "parking-lot", title: "Parking Lot" }];

function createService(options = {}) {
  let stored = options.initialValue || "[]";
  const snapshots = [];
  const storage = {
    getItem: () => stored,
    setItem: (_key, value) => {
      if (options.failWrite) throw new Error("Storage unavailable");
      stored = value;
      snapshots.push(JSON.parse(value));
    }
  };
  const attemptStore = new BrowserAttemptStore(storage, "attempts");
  return {
    service: new PracticeService({ problems, attemptStore, evaluator: options.evaluator || new FeedbackEvaluator() }),
    storage,
    snapshots
  };
}

test("practice service rejects empty submissions and retains drafts", () => {
  const { service } = createService();
  assert.throws(() => service.submit("parking-lot", {}), EmptySubmissionError);
  const draft = service.saveDraft("parking-lot", { components: "Lot owns inventory." });
  assert.equal(draft.status, "draft");
  assert.equal(draft.feedback, null);
  assert.equal(service.getAttempt(draft.id).components, "Lot owns inventory.");
});

test("submission evaluates and persists reviewable attempt history", async () => {
  const { service } = createService();
  const firstRun = service.submit("parking-lot", {
    components: "Lot owns spots and handles entry flow.",
    relationships: "Lot uses Spot.",
    tradeoffs: "If full, return failure."
  });
  const first = firstRun.attempt;
  assert.equal(first.status, "evaluating");
  await firstRun.completion;
  const secondRun = service.submit("parking-lot", { components: "Spot owns availability." });
  const second = secondRun.attempt;
  await secondRun.completion;
  assert.equal(first.status, "evaluated");
  assert.equal(first.feedback.criteria.length, 5);
  assert.equal(service.getAttempt(first.id).id, first.id);
  assert.deepEqual(service.listAttempts("parking-lot").map((attempt) => attempt.id), [second.id, first.id]);
});

test("submission persists evaluating then evaluated states", async () => {
  let finishEvaluation;
  const evaluator = { evaluate: () => new Promise((resolve) => { finishEvaluation = resolve; }) };
  const { service, snapshots } = createService({ evaluator });
  const run = service.submit("parking-lot", { components: "Lot owns spots." });
  assert.equal(run.attempt.status, "evaluating");
  assert.deepEqual(snapshots.map((items) => items[0].status), ["submitted", "evaluating"]);
  finishEvaluation({ score: 80, summary: "Clear design.", criteria: [], nextSteps: [] });
  await run.completion;
  assert.equal(run.attempt.status, "evaluated");
  assert.deepEqual(snapshots.map((items) => items[0].status), ["submitted", "evaluating", "evaluated"]);
});

test("failed evaluation can be retried to completion", async () => {
  let callCount = 0;
  const evaluator = {
    evaluate: async () => {
      callCount += 1;
      if (callCount === 1) throw new Error("temporary provider failure");
      return { score: 75, summary: "Recovered.", criteria: [], nextSteps: [] };
    }
  };
  const { service } = createService({ evaluator });
  const run = service.submit("parking-lot", { components: "Lot owns spots." });
  const failed = await run.completion;
  assert.equal(failed.status, "failed");
  assert.match(failed.failure, /temporary provider failure/);

  const retry = service.retryEvaluation(failed.id);
  assert.equal(retry.attempt.status, "evaluating");
  const recovered = await retry.completion;
  assert.equal(recovered.status, "evaluated");
  assert.equal(callCount, 2);
});

test("interrupted evaluations recover as failed and can be retried", () => {
  const initialValue = JSON.stringify([
    { id: "stuck", problemId: "parking-lot", status: "evaluating" },
    { id: "legacy-complete", problemId: "parking-lot", status: "submitted", feedback: { score: 75 } },
    {
      id: "legacy-marked-failed",
      problemId: "parking-lot",
      status: "failed",
      failure: "Evaluation did not finish. Retry it when ready.",
      feedback: { score: 55 }
    }
  ]);
  const { service } = createService({ initialValue });
  assert.equal(service.getAttempt("stuck").status, "failed");
  assert.match(service.getAttempt("stuck").failure, /did not finish/);
  assert.equal(service.getAttempt("legacy-complete").status, "evaluated");
  assert.equal(service.getAttempt("legacy-marked-failed").status, "evaluated");
});

test("malformed stored data is ignored and storage write failures propagate", () => {
  const { service: malformedService } = createService({ initialValue: "not-json" });
  assert.deepEqual(malformedService.listAttempts(), []);

  const { service: failingService } = createService({ failWrite: true });
  assert.throws(
    () => failingService.saveDraft("parking-lot", { components: "Lot owns spots." }),
    (error) => error.message === "Storage unavailable" && error.attempt.status === "draft"
  );
});
