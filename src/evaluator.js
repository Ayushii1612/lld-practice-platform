(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.LldEvaluator = factory();
  }
})(globalThis, function () {
  const criteria = [
    {
      id: "responsibilities",
      label: "Clear responsibilities",
      weight: 25,
      terms: [
        "responsibilit", "single purpose", "cohesion", "owns", "handles",
        "manages", "maintains", "records", "tracks", "decides", "assigns",
        "coordinates", "validates", "calculates", "controls"
      ]
    },
    {
      id: "relationships",
      label: "Objects and relationships",
      weight: 25,
      terms: [
        "relationship", "has-a", "has a", "uses", "depends", "composition", "association", "inheritance",
        "calls", "asks", "belongs", "contains", "delegates", "collaborates",
        "created by", "owned by", "notifies"
      ]
    },
    {
      id: "extensibility",
      label: "Extensibility",
      weight: 20,
      terms: [
        "interface", "abstract", "extend", "strategy", "factory", "polymorph", "new type",
        "plug", "swap", "without changing", "add a new", "new payment", "decouple",
        "new vehicle", "replace", "variation", "extension point"
      ]
    },
    {
      id: "behavior",
      label: "Behavior and rules",
      weight: 20,
      terms: [
        "flow", "behavior", "state", "rule", "method", "sequence", "when ",
        "then", "before", "after", "transition", "moves to", "opens", "closes",
        "returns to", "accepts", "dispenses", "releases"
      ]
    },
    {
      id: "edgeCases",
      label: "Edge cases and trade-offs",
      weight: 10,
      terms: [
        "edge", "failure", "trade-off", "tradeoff", "constraint", "concurr", "invalid", "full",
        "insufficient", "refund", "cannot", "can't", "unable", "out of stock",
        "exact change", "exactly", "recover", "reject", "no capacity", "unavailable",
        "instead of dispensing", "rather than dispensing"
      ]
    }
  ];

  function normalize(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function evaluateAttempt(problem, attempt) {
    const design = normalize(attempt && attempt.design);
    const relationships = normalize(attempt && attempt.relationships);
    const tradeoffs = normalize(attempt && attempt.tradeoffs);
    const combined = `${design}\n${relationships}\n${tradeoffs}`.toLowerCase();
    const hasSubmission = Boolean(design || relationships || tradeoffs);

    if (!hasSubmission) {
      return {
        score: 0,
        status: "needs-work",
        summary: "Add a design before reviewing it.",
        criteria: criteria.map((criterion) => ({
          id: criterion.id,
          label: criterion.label,
          weight: criterion.weight,
          score: 0,
          note: "No submission to assess yet."
        })),
        nextSteps: ["Describe at least two components and what each one owns."]
      };
    }

    const results = criteria.map((criterion) => {
      const matchedTerms = criterion.terms.filter((term) => combined.includes(term));
      const score = Math.min(100, Math.round((matchedTerms.length / 2) * 100));
      const notes = {
        responsibilities: matchedTerms.length >= 2
          ? "Your design names ownership or responsibility boundaries. Check that each component has one clear reason to change."
          : "Name each component's responsibility and the state or decision it owns.",
        relationships: matchedTerms.length >= 2
          ? "You describe how objects collaborate. Make the direction of dependencies explicit."
          : "Explain how the objects connect: who creates, owns, or calls whom?",
        extensibility: matchedTerms.length >= 2
          ? "You identify an extension point. Explain why it is needed now and how a new variation plugs in."
          : "Show how a likely variation (such as a new vehicle or payment type) can be added without changing unrelated classes.",
        behavior: matchedTerms.length >= 2
          ? "You cover behavior or a state transition. Walk through one concrete success path."
          : "Add a short sequence for one core use case, including the important state changes.",
        edgeCases: matchedTerms.length >= 1
          ? "You acknowledge constraints or failure cases. State what the system does when that case occurs."
          : "Add a failure case and one trade-off, such as what happens when capacity is exhausted."
      };
      return {
        id: criterion.id,
        label: criterion.label,
        weight: criterion.weight,
        score,
        note: notes[criterion.id]
      };
    });

    const score = Math.round(results.reduce((total, item) => total + item.score * item.weight / 100, 0));
    const nextSteps = results
      .filter((item) => item.score < 100)
      .sort((first, second) => first.score - second.score)
      .slice(0, 2)
      .map((item) => item.note);
    const problemName = problem && problem.title ? ` for ${problem.title}` : "";

    return {
      score,
      status: score >= 70 ? "ready-to-refine" : "needs-work",
      summary: score >= 70
        ? `A useful first pass${problemName}. Review the gaps below before your next attempt.`
        : `There is a starting point${problemName}, but a few design decisions need to be made explicit.`,
      criteria: results,
      nextSteps,
      strengths: results.filter((item) => item.score >= 50).map((item) => item.note),
      improvements: nextSteps,
      evaluationPath: "deterministic"
    };
  }

  class FeedbackEvaluator {
    evaluate(problem, attempt) {
      return evaluateAttempt(problem, attempt);
    }
  }

  class LlmEvaluator {
    constructor({
      apiKeyProvider = () => "",
      endpoint = "https://api.openai.com/v1/chat/completions",
      model = "gpt-4o-mini",
      fallback = new FeedbackEvaluator(),
      fetchImpl = globalThis.fetch && globalThis.fetch.bind(globalThis),
      timeoutMs = 15000
    } = {}) {
      this.apiKeyProvider = apiKeyProvider;
      this.endpoint = endpoint;
      this.model = model;
      this.fallback = fallback;
      this.fetchImpl = fetchImpl;
      this.timeoutMs = timeoutMs;
    }

    async evaluate(problem, attempt) {
      let apiKey;
      try {
        apiKey = this.apiKeyProvider();
      } catch {
        return this.useFallback(problem, attempt, "api_key_unavailable");
      }
      if (!apiKey) return this.useFallback(problem, attempt, "missing_api_key");
      if (typeof this.fetchImpl !== "function") return this.useFallback(problem, attempt, "fetch_unavailable");

      let controller;
      let timeoutId;
      try {
        controller = typeof AbortController === "function"
          ? new AbortController()
          : { signal: undefined, abort() {} };
        const request = Promise.resolve().then(async () => {
          const response = await this.fetchImpl(this.endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`
            },
            signal: controller.signal,
            body: JSON.stringify({
              model: this.model,
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content: "Review an LLD design fairly. There may be multiple valid designs. Ground feedback in the submitted text; do not require a specific pattern. Return JSON only with numeric score from 0 to 100, a concise summary, strengths array, and improvements array."
                },
                {
                  role: "user",
                  content: JSON.stringify({
                    problem: {
                      title: problem && problem.title,
                      prompt: problem && problem.prompt,
                      requirements: problem && problem.requirements
                    },
                    submission: {
                      components: normalize(attempt && attempt.design).slice(0, 8000),
                      relationships: normalize(attempt && attempt.relationships).slice(0, 8000),
                      tradeoffs: normalize(attempt && attempt.tradeoffs).slice(0, 8000)
                    }
                  })
                }
              ]
            })
          });
          if (!response.ok) throw new Error(`LLM request failed with status ${response.status}`);
          return response.json();
        });
        const timeout = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            controller.abort();
            reject(new Error("LLM request timed out"));
          }, this.timeoutMs);
        });
        const payload = await Promise.race([request, timeout]);
        const content = payload && payload.choices && payload.choices[0]
          && payload.choices[0].message && payload.choices[0].message.content;
        const review = this.parseReview(content);
        const improvements = this.normalizeList(review.improvements);
        const strengths = this.normalizeList(review.strengths);
        const score = Math.max(0, Math.min(100, Math.round(Number(review.score) || 0)));
        const summary = typeof review.summary === "string" && review.summary.trim()
          ? review.summary.trim()
          : "Review the strengths and improvements below.";
        const criteria = [{
          id: "qualitative-review",
          label: "AI design review",
          weight: 100,
          score,
          note: improvements.join(" ") || summary
        }];
        return {
          score,
          status: score >= 70 ? "ready-to-refine" : "needs-work",
          summary,
          criteria,
          strengths,
          improvements,
          nextSteps: improvements.slice(0, 2),
          evaluationPath: "llm"
        };
      } catch (error) {
        return this.useFallback(problem, attempt, error && error.message ? error.message : "llm_request_failed");
      } finally {
        clearTimeout(timeoutId);
      }
    }

    async useFallback(problem, attempt, reason) {
      const feedback = await this.fallback.evaluate(problem, attempt);
      return { ...feedback, evaluationPath: "deterministic_fallback", fallbackReason: reason };
    }

    parseReview(content) {
      if (typeof content !== "string") throw new Error("LLM response did not contain review text");
      const json = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const review = JSON.parse(json);
      if (!review || typeof review !== "object" || !Number.isFinite(Number(review.score))) {
        throw new Error("LLM response was missing a numeric score");
      }
      return review;
    }

    normalizeList(value) {
      return Array.isArray(value)
        ? value.filter((item) => typeof item === "string" && item.trim()).slice(0, 4).map((item) => item.trim())
        : [];
    }
  }

  function createConfiguredEvaluator(options) {
    return new LlmEvaluator(options);
  }

  return { evaluateAttempt, FeedbackEvaluator, LlmEvaluator, createConfiguredEvaluator };
});
