# AI Usage

AI assistance was used to shape and implement this focused prototype. The key decisions and review outcomes:

1. **Feedback strategy:** AI proposed making an LLM-generated design review the default. I kept the deterministic rubric as the no-credential default, then added an explicit opt-in LLM path with a timeout and deterministic fallback. This avoids making a provider or its subjective judgment a prerequisite for practice.
2. **Practice loop:** AI suggested adding accounts, progress levels, and leaderboards as engagement features. I rejected them as outside the assignment's central learner journey; browser-local attempt history is enough to support reviewing and retrying.
3. **Submission shape:** AI recommended a single free-form answer for speed. I split the response into responsibilities, relationships/flow, and trade-offs so the learner is prompted to make important LLD decisions visible, while allowing notes, diagram notation, or code in each field.
4. **Architecture:** AI outlined separate backend services for attempts and evaluation. I chose a small monolith with a standalone evaluator contract and local persistence. This keeps the prototype runnable while leaving evaluation replaceable.
5. **Verification:** AI-assisted test design surfaced a rubric score-cap edge case: repeated evidence signals could produce a value above 100. The evaluator now caps criterion scores, and a Node test protects that behavior.

Without a key, evaluation is local heuristic matching and no learner content leaves the browser. With opt-in LLM review, the problem and submitted design are sent directly to the configured OpenAI-compatible endpoint. The key is kept only in the current tab's session storage; this is for development, not a production credential boundary.
