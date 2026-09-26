(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.LldPractice = factory();
  }
})(globalThis, function () {
  class BrowserAttemptStore {
    constructor(storage, key) {
      this.storage = storage;
      this.key = key;
    }

    load() {
      try {
        const saved = JSON.parse(this.storage.getItem(this.key) || "[]");
        return Array.isArray(saved) ? saved.filter((attempt) => attempt && typeof attempt.id === "string") : [];
      } catch {
        return [];
      }
    }

    save(attempts) {
      this.storage.setItem(this.key, JSON.stringify(attempts));
    }
  }

  class EmptySubmissionError extends Error {
    constructor() {
      super("Add some design detail before submitting.");
      this.name = "EmptySubmissionError";
    }
  }

  class PracticeService {
    constructor({ problems, attemptStore, evaluator }) {
      this.problems = problems;
      this.attemptStore = attemptStore;
      this.evaluator = evaluator;
      this.attempts = attemptStore.load();
      this.recoverInterruptedEvaluations();
    }

    getProblem(problemId) {
      return this.problems.find((problem) => problem.id === problemId) || this.problems[0];
    }

    getAttempt(attemptId) {
      return this.attempts.find((attempt) => attempt.id === attemptId);
    }

    listAttempts(problemId) {
      return this.attempts
        .filter((attempt) => !problemId || attempt.problemId === problemId)
        .slice()
        .sort((first, second) => new Date(second.updatedAt) - new Date(first.updatedAt));
    }

    saveDraft(problemId, fields, attemptId) {
      return this.saveAttempt(problemId, fields, "draft", attemptId);
    }

    submit(problemId, fields, attemptId) {
      const components = this.normalize(fields.components);
      const relationships = this.normalize(fields.relationships);
      const tradeoffs = this.normalize(fields.tradeoffs);
      if (!components && !relationships && !tradeoffs) throw new EmptySubmissionError();

      const attempt = this.saveAttempt(problemId, { ...fields, components, relationships, tradeoffs }, "submitted", attemptId);
      return this.beginEvaluation(attempt);
    }

    retryEvaluation(attemptId) {
      const attempt = this.getAttempt(attemptId);
      if (!attempt || attempt.status !== "failed") throw new Error("Only failed evaluations can be retried.");
      attempt.status = "evaluating";
      attempt.failure = null;
      attempt.updatedAt = new Date().toISOString();
      this.persist(attempt);
      return this.beginEvaluation(attempt);
    }

    beginEvaluation(attempt) {
      attempt.status = "evaluating";
      attempt.failure = null;
      attempt.updatedAt = new Date().toISOString();
      this.persist(attempt);
      return { attempt, completion: this.completeEvaluation(attempt) };
    }

    async completeEvaluation(attempt) {
      try {
        attempt.feedback = await this.evaluator.evaluate(this.getProblem(attempt.problemId), {
          design: attempt.components,
          relationships: attempt.relationships,
          tradeoffs: attempt.tradeoffs
        });
        attempt.status = "evaluated";
        attempt.failure = null;
      } catch (error) {
        attempt.status = "failed";
        attempt.failure = error && error.message ? error.message : "Evaluation failed. Retry when ready.";
      }
      attempt.updatedAt = new Date().toISOString();
      this.persist(attempt);
      return attempt;
    }

    recoverInterruptedEvaluations() {
      let changed = false;
      this.attempts.forEach((attempt) => {
        if ((attempt.status === "submitted" && attempt.feedback)
          || (attempt.status === "failed" && attempt.feedback && attempt.failure === "Evaluation did not finish. Retry it when ready.")) {
          attempt.status = "evaluated";
          attempt.failure = null;
          changed = true;
        } else if (attempt.status === "submitted" || attempt.status === "evaluating") {
          attempt.status = "failed";
          attempt.failure = "Evaluation did not finish. Retry it when ready.";
          changed = true;
        }
      });
      if (changed) {
        try {
          this.attemptStore.save(this.attempts);
        } catch {
          // Keep the recovered state available for this browser session.
        }
      }
    }

    persist(attempt) {
      try {
        this.attemptStore.save(this.attempts);
      } catch (error) {
        error.attempt = attempt;
        throw error;
      }
    }

    saveAttempt(problemId, fields, status, attemptId, feedback = null) {
      const existing = attemptId && this.getAttempt(attemptId);
      const attempt = {
        id: existing ? existing.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        problemId,
        components: this.normalize(fields.components),
        relationships: this.normalize(fields.relationships),
        tradeoffs: this.normalize(fields.tradeoffs),
        format: fields.format || "Design notes",
        status,
        updatedAt: new Date().toISOString(),
        feedback
      };
      if (existing) this.attempts = this.attempts.map((item) => item.id === attempt.id ? attempt : item);
      else this.attempts.unshift(attempt);
      this.persist(attempt);
      return attempt;
    }

    normalize(value) {
      return typeof value === "string" ? value.trim() : "";
    }
  }

  return { BrowserAttemptStore, EmptySubmissionError, PracticeService };
});
