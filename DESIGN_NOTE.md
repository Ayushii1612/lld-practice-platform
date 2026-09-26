# Design Note

## MVP and learner flow

Choose one of three focused prompts, review its requirements, write components/responsibilities, relationships/core flow, and edge cases/trade-offs, then save a draft or submit. Submission produces a rubric review; the attempt remains available in Recent attempts. Starting a fresh attempt keeps the earlier review intact.

## Domain model

- `Problem`: a prompt, requirements, constraints, and review cues.
- `Attempt`: a learner's format and design content for one problem, plus status and timestamp.
- `Feedback`: a weighted result with criterion notes and next steps.
- `FeedbackEvaluator`: evaluates a problem and attempt without owning persistence or UI concerns.
- `BrowserAttemptStore`: loads and saves attempt records through browser `localStorage`.
- `PracticeService`: validates submissions and coordinates draft/submit behavior, attempt history, persistence, and evaluator injection.

These responsibilities are implemented as injectable classes in `src/practice-service.js` and `src/evaluator.js`. `src/app.js` owns rendering and interaction only. The evaluator returns data rather than HTML, so a future LLM evaluator, human review, or different submission renderer can be introduced without changing the rubric view's core shape.

## Evaluation approach

The default path is deterministic: five transparent criteria cover responsibilities (25%), relationships (25%), extensibility (20%), behavior (20%), and edge cases/trade-offs (10%). With an optional tab-scoped API key, `LlmEvaluator` sends the problem and submission to an OpenAI-compatible chat-completion endpoint for a qualitative score, strengths, and improvements. It has a bounded timeout and falls back to the deterministic evaluator on missing configuration, network/HTTP/parse errors, or timeout. Feedback records `evaluationPath` so the UI can identify the path used. Browser-only keys are not production secrets; the direct API call is a prototype option, not a secure deployment pattern.

Empty submissions are rejected at the service boundary; partial submissions can be reviewed but receive explicit gaps. Feedback wording is question-oriented and allows more than one valid design.

The LLM path intentionally presents one combined qualitative score and note rather than five sub-scores; its strengths and improvements provide the detail without implying criterion-level precision the model does not guarantee.

This is a prototype heuristic, not semantic grading. A learner can use a valid design that scores poorly because terminology differs, or score well while the design is flawed. The UI states this limitation. Do not use this score for hiring or certification.

## Async lifecycle and production scale

Submissions persist through `submitted -> evaluating -> evaluated` or `failed`. The UI shows a pending state, exposes retry for failures, and converts an interrupted `submitted`/`evaluating` record to retryable `failed` on reload. LLM calls have a 15-second timeout; most provider/network failures complete through deterministic fallback instead of failing the attempt. If browser storage is unavailable, the current editor content remains and the UI reports the persistence issue.

The static prototype has no shared identity or storage: concurrent learners each use their own browser, so it does not synchronize attempts across devices. For a production cohort, keep the same service/evaluator contract behind an authenticated API, store attempts and lifecycle state in a shared database, and scale stateless app instances horizontally. A slower AI provider can be placed behind a bounded job queue with persisted `evaluating` state, per-attempt idempotency, timeout, retry limits/backoff, and a visible failed state. Deterministic feedback remains available when the model is unavailable. This adds only the infrastructure needed for shared accounts and long-running evaluation, not a microservice decomposition.

## Next extension points

`PracticeService` depends only on `evaluate(problem, attempt)`. The concrete evaluator can be replaced by a richer rubric, a human reviewer, or another model adapter without changing attempt persistence or UI controls. Submission format is stored separately from content so a future diagram or code editor can use the same attempt lifecycle.
