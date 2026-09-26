const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appSource = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");

test("editing a saved attempt resolves it through PracticeService", () => {
  assert.match(appSource, /practiceService\.getAttempt\(activeAttemptId\)/);
  assert.doesNotMatch(appSource, /\battempts\.find\(/);
});
