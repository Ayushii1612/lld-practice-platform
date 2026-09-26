const problems = [
  {
    id: "parking-lot",
    title: "Parking Lot",
    level: "FOUNDATIONS",
    time: "25 MIN",
    prompt: "Design a parking lot that can admit vehicles, assign a suitable spot, and release it when the vehicle leaves. Keep the design easy to extend as the lot changes.",
    requirements: ["Multiple spot and vehicle types", "Ticket created on entry; fee settled on exit", "No assignment when the lot is full"],
    consider: ["Who decides spot fit?", "How is an occupied spot released?"]
  },
  {
    id: "elevator",
    title: "Elevator System",
    level: "STATE & BEHAVIOR",
    time: "30 MIN",
    prompt: "Design a group of elevators that accepts floor requests and moves safely between floors. Focus on request handling and state transitions, not dispatch optimization at scale.",
    requirements: ["Hall and in-car requests", "Elevator has direction and current floor", "Door and movement states are valid"],
    consider: ["Who owns the state machine?", "What if a request is invalid?"]
  },
  {
    id: "vending-machine",
    title: "Vending Machine",
    level: "STATE & BEHAVIOR",
    time: "20 MIN",
    prompt: "Design a vending machine that accepts payment, dispenses an item, and returns change when needed. Make the transaction behavior clear when a step fails.",
    requirements: ["Inventory and prices", "Payment before dispense", "Refund or recovery for failure"],
    consider: ["How does stock change?", "Who coordinates the transaction?"]
  }
];

const storageKey = "design-gym-attempts-v1";
const llmKeyStorageKey = "design-gym-llm-api-key";
function getLlmApiKey() {
  try {
    return window.sessionStorage.getItem(llmKeyStorageKey) || "";
  } catch {
    return "";
  }
}

const practiceService = new window.LldPractice.PracticeService({
  problems,
  attemptStore: new window.LldPractice.BrowserAttemptStore(window.localStorage, storageKey),
  evaluator: window.LldEvaluator.createConfiguredEvaluator({ apiKeyProvider: getLlmApiKey })
});
const elements = {
  problemList: document.querySelector("#problem-list"),
  problemHeading: document.querySelector("#problem-heading"),
  briefStrip: document.querySelector("#brief-strip"),
  historyList: document.querySelector("#history-list"),
  historyCount: document.querySelector("#history-count"),
  form: document.querySelector("#attempt-form"),
  components: document.querySelector("#components"),
  relationships: document.querySelector("#relationships"),
  tradeoffs: document.querySelector("#tradeoffs"),
  saveStatus: document.querySelector("#save-status"),
  feedback: document.querySelector("#feedback-content"),
  submitButton: document.querySelector('#attempt-form button[type="submit"]'),
  apiKeyInput: document.querySelector("#llm-api-key"),
  apiKeyStatus: document.querySelector("#llm-key-status")
};

let selectedProblemId = problems[0].id;
let activeAttemptId = null;

function selectedProblem() {
  return practiceService.getProblem(selectedProblemId);
}

function setStatus(message, tone) {
  elements.saveStatus.textContent = message;
  if (tone) elements.saveStatus.dataset.tone = tone;
  else delete elements.saveStatus.dataset.tone;
}

function getFormat() {
  return document.querySelector('input[name="format"]:checked').value;
}

function setFormat(value) {
  const choice = document.querySelector(`input[name="format"][value="${CSS.escape(value || "Design notes")}"]`);
  if (choice) choice.checked = true;
  updateFormatTreatment();
}

function updateFormatTreatment() {
  const format = getFormat();
  const mode = format.startsWith("Diagram") ? "diagram" : format.startsWith("Code") ? "code" : "notes";
  elements.form.dataset.format = mode;
  const hints = {
    notes: {
      components: "Name the main classes or objects. What does each one own, decide, or do?",
      relationships: "Show how objects collaborate. A short sequence or ASCII sketch works."
    },
    diagram: {
      components: "Add class boxes or Mermaid class notation, with key responsibilities.",
      relationships: "Use arrows or Mermaid/ASCII notation to show ownership and call direction."
    },
    code: {
      components: "Paste pseudocode or a code sketch. Mark each class's responsibility.",
      relationships: "Add method calls or a short code sequence showing collaboration."
    }
  };
  elements.components.placeholder = hints[mode].components;
  elements.relationships.placeholder = hints[mode].relationships;
}

function readForm() {
  return {
    components: elements.components.value.trim(),
    relationships: elements.relationships.value.trim(),
    tradeoffs: elements.tradeoffs.value.trim(),
    format: getFormat()
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function renderProblems() {
  elements.problemList.innerHTML = problems.map((problem, index) => `
    <button class="problem-option" type="button" data-problem="${problem.id}" aria-current="${problem.id === selectedProblemId}">
      <span class="problem-index">0${index + 1}</span>
      <span class="problem-name">${problem.title}<span class="problem-level">${problem.level}</span></span>
      <span class="problem-arrow" aria-hidden="true">${problem.id === selectedProblemId ? "↗" : "›"}</span>
    </button>
  `).join("");

  elements.problemList.querySelectorAll("[data-problem]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedProblemId = button.dataset.problem;
      startNewAttempt();
      renderProblems();
      renderProblem();
      renderHistory();
      showEmptyFeedback();
    });
  });
}

function renderProblem() {
  const problem = selectedProblem();
  elements.problemHeading.innerHTML = `
    <div class="problem-kicker"><span>${problem.level}</span><span>${problem.time}</span></div>
    <h1 class="problem-title">${problem.title}</h1>
    <p class="problem-prompt">${problem.prompt}</p>
  `;
  elements.briefStrip.innerHTML = `
    <div><p class="brief-title">Requirements</p><ul class="brief-list">${problem.requirements.map((item) => `<li>${item}</li>`).join("")}</ul></div>
    <div><p class="brief-title">Worth considering</p><ul class="brief-list">${problem.consider.map((item) => `<li>${item}</li>`).join("")}</ul></div>
  `;
}

function sortedAttempts() {
  return practiceService.listAttempts(selectedProblemId);
}

function renderHistory() {
  const problemAttempts = sortedAttempts();
  elements.historyCount.textContent = String(practiceService.listAttempts().length);
  if (!problemAttempts.length) {
    elements.historyList.innerHTML = '<p class="history-empty">Your first attempt is waiting here.</p>';
    return;
  }
  elements.historyList.innerHTML = problemAttempts.slice(0, 5).map((attempt, index) => {
    const date = new Date(attempt.updatedAt);
    const when = Number.isNaN(date.getTime()) ? "Saved attempt" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const label = attempt.status === "evaluated" && attempt.feedback
      ? `${attempt.feedback.score}/100`
      : ({ evaluating: "Reviewing…", failed: "Failed · retry", submitted: "Submitted" })[attempt.status] || "Draft";
    return `<button class="history-item" type="button" data-attempt="${escapeHtml(attempt.id)}">
      <span><span class="history-title">Attempt ${problemAttempts.length - index}</span><span class="history-meta">${when} · ${attempt.format || "Design notes"}</span></span>
      <span class="history-score">${label}</span>
    </button>`;
  }).join("");
  elements.historyList.querySelectorAll("[data-attempt]").forEach((button) => {
    button.addEventListener("click", () => loadAttempt(button.dataset.attempt));
  });
}

function showEmptyFeedback() {
  elements.feedback.innerHTML = `
    <div class="feedback-placeholder"><span class="placeholder-number">01</span>
      <h2>Your review, after you submit.</h2>
      <p>You'll get a criterion-by-criterion read on the design signals you made explicit, plus a couple of concrete next steps.</p>
    </div>`;
}

function renderFeedback(feedback) {
  if (!feedback) {
    showEmptyFeedback();
    return;
  }
  const statusLabel = feedback.status === "ready-to-refine" ? "Signals present" : "Signals to strengthen";
  const pathLabel = feedback.evaluationPath === "llm"
    ? "LLM REVIEW"
    : feedback.evaluationPath === "deterministic_fallback"
      ? `RULE-BASED FALLBACK · ${feedback.fallbackReason || "LLM unavailable"}`
      : "RULE-BASED REVIEW";
  elements.feedback.innerHTML = `
    <div class="feedback-summary">
      <div class="score-row"><span class="score-value">${feedback.score}</span><span class="score-denom">/ 100 signal points</span><span class="score-label">${statusLabel}</span></div>
      <p>${escapeHtml(feedback.summary)}</p>
      <span class="evaluation-path">${escapeHtml(pathLabel)}</span>
    </div>
    <h2 class="rubric-title">Design signals</h2>
    <p class="rubric-intro">Weighted checks · Evidence prompts, not an answer key.</p>
    <div class="rubric-list">${(feedback.criteria || []).map((criterion) => `
      <div class="rubric-item">
        <span class="rubric-label">${escapeHtml(criterion.label)}</span><span class="rubric-percent">${criterion.score}% · ${criterion.weight} pts</span>
        <div class="rubric-track"><div class="rubric-fill" style="width:${criterion.score}%"></div></div>
        <p class="rubric-note-text">${escapeHtml(criterion.note)}</p>
      </div>`).join("")}</div>
    ${(feedback.strengths || []).length ? `<div class="evaluation-strengths"><h3>What works</h3><ul>${feedback.strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
    ${(feedback.improvements || []).length ? `<div class="evaluation-improvements"><h3>To strengthen</h3><ul>${feedback.improvements.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
    <div class="next-steps"><p class="eyebrow">NEXT THINGS TO TRY</p><ol>${(feedback.nextSteps || []).length
      ? feedback.nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")
      : "<li>Try a different design and compare the trade-offs you made.</li>"}</ol></div>`;
}

function renderAttempt(attempt) {
  if (!attempt || attempt.status === "draft") {
    showEmptyFeedback();
    return;
  }
  if (attempt.status === "evaluating" || attempt.status === "submitted") {
    elements.feedback.innerHTML = `
      <div class="evaluation-pending" role="status" aria-live="polite">
        <div class="evaluation-spinner" aria-hidden="true"></div>
        <h2>Reviewing your design</h2>
        <p>Checking your design signals. This can take a few seconds when AI review is enabled.</p>
      </div>`;
    return;
  }
  if (attempt.status === "failed") {
    elements.feedback.innerHTML = `
      <div class="evaluation-failed" role="status">
        <h2>Review couldn't finish</h2>
        <p>${escapeHtml(attempt.failure || "The evaluator did not return feedback. You can retry this attempt.")}</p>
        <button class="button button-primary" type="button" data-retry-evaluation="${escapeHtml(attempt.id)}">Retry evaluation</button>
      </div>`;
    return;
  }
  renderFeedback(attempt.feedback);
}

function startEvaluation(job) {
  const attempt = job.attempt;
  activeAttemptId = attempt.id;
  setStatus("Evaluation in progress.");
  renderHistory();
  renderAttempt(attempt);
  const startedAt = Date.now();
  job.completion.then((completed) => {
    const pendingDisplayTime = Math.max(0, 180 - (Date.now() - startedAt));
    window.setTimeout(() => {
      renderHistory();
      if (activeAttemptId === completed.id) {
        renderAttempt(completed);
        setStatus(completed.status === "failed" ? "Evaluation failed. Retry is available." : "Evaluation complete.",
          completed.status === "failed" ? "error" : undefined);
      }
    }, pendingDisplayTime);
  }).catch((error) => {
    const failedAttempt = error.attempt || attempt;
    renderHistory();
    if (activeAttemptId === failedAttempt.id) {
      renderAttempt(failedAttempt);
      setStatus("Could not save the evaluation state.", "error");
    }
  });
}

function updateApiKeyStatus() {
  elements.apiKeyStatus.textContent = getLlmApiKey()
    ? "Key is set for this tab. LLM review will be attempted."
    : "No key set. Deterministic fallback is active.";
}

function startNewAttempt() {
  activeAttemptId = null;
  elements.form.reset();
  elements.components.value = "";
  elements.relationships.value = "";
  elements.tradeoffs.value = "";
  setStatus("Draft stays in this browser.");
  showEmptyFeedback();
}

function saveAttempt(status) {
  const values = readForm();
  if (status === "submitted") {
    try {
      startEvaluation(practiceService.submit(selectedProblemId, values, activeAttemptId));
      return true;
    } catch (error) {
      const attempt = error.attempt || null;
      setStatus(error instanceof window.LldPractice.EmptySubmissionError
        ? error.message
        : "Could not save. Check this browser's storage settings.", "error");
      if (attempt) {
        activeAttemptId = attempt.id;
        renderHistory();
        renderAttempt(attempt);
      }
      return false;
    }
  }

  let attempt;
  try {
    attempt = practiceService.saveDraft(selectedProblemId, values, activeAttemptId);
    setStatus("Saved in this browser.");
  } catch (error) {
    attempt = error.attempt || null;
    setStatus("Could not save. Check this browser's storage settings.", "error");
  }
  if (!attempt) return false;
  activeAttemptId = attempt.id;
  renderHistory();
  renderAttempt(attempt);
  return true;
}

function loadAttempt(id) {
  const attempt = practiceService.getAttempt(id);
  if (!attempt) return;
  selectedProblemId = attempt.problemId;
  activeAttemptId = attempt.id;
  elements.components.value = attempt.components || "";
  elements.relationships.value = attempt.relationships || "";
  elements.tradeoffs.value = attempt.tradeoffs || "";
  setFormat(attempt.format);
  setStatus(attempt.status === "evaluating" ? "Evaluation in progress." : attempt.status === "failed" ? "Evaluation failed. Retry is available." : attempt.status === "evaluated" ? "Reviewing a completed attempt." : "Draft loaded.");
  renderProblems();
  renderProblem();
  renderHistory();
  renderAttempt(attempt);
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!saveAttempt("submitted") && !elements.components.value.trim() && !elements.relationships.value.trim() && !elements.tradeoffs.value.trim()) elements.components.focus();
});

document.querySelector("#save-draft").addEventListener("click", () => saveAttempt("draft"));
document.querySelector("#new-attempt").addEventListener("click", () => {
  startNewAttempt();
  elements.components.focus();
});

document.querySelector("#use-llm-key").addEventListener("click", () => {
  const key = elements.apiKeyInput.value.trim();
  try {
    if (key) window.sessionStorage.setItem(llmKeyStorageKey, key);
    else window.sessionStorage.removeItem(llmKeyStorageKey);
    elements.apiKeyInput.value = "";
    updateApiKeyStatus();
  } catch {
    elements.apiKeyStatus.textContent = "This browser could not store the key for this tab.";
  }
});

document.querySelector("#clear-llm-key").addEventListener("click", () => {
  try {
    window.sessionStorage.removeItem(llmKeyStorageKey);
  } catch {
    elements.apiKeyStatus.textContent = "This browser could not clear the key.";
    return;
  }
  elements.apiKeyInput.value = "";
  updateApiKeyStatus();
});

elements.feedback.addEventListener("click", (event) => {
  const retryButton = event.target.closest("[data-retry-evaluation]");
  if (!retryButton) return;
  try {
    startEvaluation(practiceService.retryEvaluation(retryButton.dataset.retryEvaluation));
  } catch (error) {
    setStatus(error.message, "error");
  }
});

document.querySelectorAll('input[name="format"]').forEach((radio) => {
  radio.addEventListener("change", updateFormatTreatment);
});

elements.form.addEventListener("input", () => {
  if (activeAttemptId) {
    const active = practiceService.getAttempt(activeAttemptId);
    if (active && active.status !== "draft") {
      activeAttemptId = null;
      showEmptyFeedback();
      setStatus("Editing a review starts a new attempt.");
    }
  }
});

updateFormatTreatment();
updateApiKeyStatus();
renderProblems();
renderProblem();
renderHistory();
showEmptyFeedback();
