# Design Gym: LLD Practice

A focused, browser-based practice loop for Low-Level Design problems: choose a prompt, make a design, submit, review explainable feedback, and try again.

## Run

Requires a modern browser and Node.js for tests. Serve the folder with Python:

```powershell
py -m http.server 4173
```

Open http://localhost:4173. Attempts are stored in this browser's local storage; no account or backend is required.

## Test

```powershell
npm test
```

## What's included

- Parking Lot, Elevator System, and Vending Machine prompts with requirements and design cues.
- Notes, diagram notation, or code snippets in structured submission fields.
- Draft saving, submitted attempt history, review, and retry.
- Explainable five-part deterministic feedback, plus optional qualitative LLM review with deterministic fallback.
- Persisted evaluating/failed states, an evaluation spinner, timeout handling, and retry for failed reviews.
- Responsive layout for desktop and mobile widths.

## Optional LLM review

Open **Optional AI review**, enter an OpenAI-compatible API key, and choose **Use for this tab**. The key stays in `sessionStorage`; without a key, the app uses deterministic feedback. The browser calls the endpoint directly, so the key is visible to the browser user and may be blocked by provider CORS policy. Use only a disposable development key. A production deployment should keep provider credentials behind a server-side proxy.

## Limitations

The deterministic rubric detects vocabulary signals; it does not understand a design or establish correctness. Scores are reflection prompts, not a hiring or certification result. Data is local to the browser and can be lost if its storage is cleared. LLM evaluation is optional and sends the problem and submission to the configured provider; there is no account sync.

See [RESEARCH_NOTE.md](RESEARCH_NOTE.md), [DESIGN_NOTE.md](DESIGN_NOTE.md), and [AI_USAGE.md](AI_USAGE.md) for research, design choices, and AI-assisted decisions.
