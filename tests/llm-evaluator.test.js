const test = require("node:test");
const assert = require("node:assert/strict");
const { LlmEvaluator } = require("../src/evaluator.js");

const problem = { title: "Parking Lot", prompt: "Assign a suitable spot.", requirements: ["No assignment when full"] };
const attempt = { design: "Lot owns spots.", relationships: "Lot uses Spot.", tradeoffs: "Return failure when full." };

function response(content, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ choices: [{ message: { content } }] })
  };
}

test("missing key skips the network and marks deterministic fallback", async () => {
  let requestCount = 0;
  const evaluator = new LlmEvaluator({
    apiKeyProvider: () => "",
    fetchImpl: async () => { requestCount += 1; }
  });
  const result = await evaluator.evaluate(problem, attempt);
  assert.equal(requestCount, 0);
  assert.equal(result.evaluationPath, "deterministic_fallback");
  assert.equal(result.fallbackReason, "missing_api_key");
  assert.equal(result.criteria.length, 5);
});

test("network and malformed-response errors use deterministic fallback", async () => {
  const offline = new LlmEvaluator({ apiKeyProvider: () => "test-key", fetchImpl: async () => { throw new Error("offline"); } });
  const networkResult = await offline.evaluate(problem, attempt);
  assert.equal(networkResult.evaluationPath, "deterministic_fallback");
  assert.equal(networkResult.fallbackReason, "offline");

  const malformed = new LlmEvaluator({
    apiKeyProvider: () => "test-key",
    fetchImpl: async () => response("not valid JSON")
  });
  assert.equal((await malformed.evaluate(problem, attempt)).evaluationPath, "deterministic_fallback");
});

test("valid LLM review returns normalized qualitative feedback", async () => {
  const evaluator = new LlmEvaluator({
    apiKeyProvider: () => "test-key",
    fetchImpl: async () => response(JSON.stringify({
      score: 82,
      summary: "Clear ownership, but release behavior needs detail.",
      strengths: ["Lot owns inventory."],
      improvements: ["Describe how a ticket releases a spot."]
    }))
  });
  const result = await evaluator.evaluate(problem, attempt);
  assert.equal(result.evaluationPath, "llm");
  assert.equal(result.score, 82);
  assert.equal(result.criteria[0].label, "AI design review");
  assert.deepEqual(result.strengths, ["Lot owns inventory."]);
  assert.deepEqual(result.nextSteps, ["Describe how a ticket releases a spot."]);
});

test("a stalled LLM request times out and falls back", async () => {
  const evaluator = new LlmEvaluator({
    apiKeyProvider: () => "test-key",
    timeoutMs: 5,
    fetchImpl: async () => new Promise(() => {})
  });
  const result = await evaluator.evaluate(problem, attempt);
  assert.equal(result.evaluationPath, "deterministic_fallback");
  assert.equal(result.fallbackReason, "LLM request timed out");
});

test("a stalled response body also times out and falls back", async () => {
  const evaluator = new LlmEvaluator({
    apiKeyProvider: () => "test-key",
    timeoutMs: 5,
    fetchImpl: async () => ({ ok: true, json: () => new Promise(() => {}) })
  });
  const result = await evaluator.evaluate(problem, attempt);
  assert.equal(result.evaluationPath, "deterministic_fallback");
  assert.equal(result.fallbackReason, "LLM request timed out");
});
