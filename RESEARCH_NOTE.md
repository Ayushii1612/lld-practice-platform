# Research Note: Making LLD Practice Reviewable

## Problem framing

LLD prompts are easy to find; the harder part is deciding whether a design is coherent. A learner can list classes yet still miss ownership, collaboration, state transitions, failure behavior, or the reason for an abstraction. A useful practice product should therefore elicit design rationale, not just a diagram or a class-name checklist.

This is brief desk research and product reasoning, not primary user research. The working audience is an individual learner practicing interview-style object design in short sessions.

## What the research suggests

Deliberate practice is more than repetition: the learner needs a defined task, feedback on performance, and a chance to use that feedback in a subsequent attempt. For this product, that supports keeping the loop tight: choose a bounded problem, make a design, review specific gaps, and try again. An attempt history matters because improvement is comparative; the learner should be able to revisit what they submitted and what changed.

Feedback is most useful when it helps answer three questions: What was the intended goal? What evidence in this work says how I am doing? What is the next action? Broad labels such as “good design” do little for a learner. In LLD, feedback should point to evidence (for example, an explicit owner, a dependency direction, or an unhandled full-capacity case) and offer a concrete question or next step. Because multiple designs can be valid, feedback should not prescribe one canonical class diagram.

These findings are translated into an explainable review rather than a hidden “AI score.” The prototype checks for explicit design signals across five areas: responsibilities, object relationships, extensibility, behavior, and edge cases/trade-offs. Each result includes its own note. The checks are intentionally modest and are labeled as prompts for reflection, not a correctness judgment.

## MVP direction

The first release contains three familiar problems: Parking Lot, Elevator System, and Vending Machine. Each brief has a short scenario, functional constraints, and a couple of design questions. A learner can submit design notes, diagram notation, or code snippets in the same structured text areas. The platform saves drafts and submitted attempts in the browser, shows criterion-level feedback, and keeps prior work available for review and retry.

The product deliberately avoids accounts, leaderboards, course progression, and collaboration. LLM feedback is optional rather than required: deterministic review works without credentials, and a configured development key enables qualitative review. This keeps the core practice loop available while allowing comparison of deterministic and model-assisted feedback.

## Evaluation split and risks

Deterministic evaluation is appropriate for basic completeness and for repeatable checks. It can show whether the write-up appears to discuss responsibilities, relationships, behavior, extension points, and edge cases. It cannot reliably judge whether the chosen abstraction is appropriate, whether the design is internally consistent, or whether a trade-off is sound. Keyword signals can also be gamed or missed when the learner uses different vocabulary.

An LLM can add contextual review of a design, but it should cite the learner's own text, identify uncertainty, ask questions rather than demand one pattern, and remain separate from deterministic checks. The interface makes the evaluator path and its limitations visible. A human or alternate rubric should remain possible. In this browser-only prototype, the optional provider request is direct and its key is session-scoped; a production system should keep credentials on a server.

## References

- Ericsson, K. A., Krampe, R. T., & Tesch-Römer, C. (1993). “The Role of Deliberate Practice in the Acquisition of Expert Performance.” *Psychological Review*, 100(3), 363–406. https://doi.org/10.1037/0033-295X.100.3.363
- Hattie, J., & Timperley, H. (2007). “The Power of Feedback.” *Review of Educational Research*, 77(1), 81–112. https://doi.org/10.3102/003465430298487
