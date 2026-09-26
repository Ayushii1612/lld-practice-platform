const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateAttempt } = require("../src/evaluator.js");

test("empty submission gets a clear prompt and no false score", () => {
  const result = evaluateAttempt({ title: "Parking Lot" }, {});
  assert.equal(result.score, 0);
  assert.equal(result.criteria.length, 5);
  assert.match(result.nextSteps[0], /two components/i);
});

test("missing inputs fail closed instead of throwing", () => {
  const result = evaluateAttempt(null, null);
  assert.equal(result.score, 0);
  assert.equal(result.status, "needs-work");
});

test("partial submission returns weighted, actionable feedback", () => {
  const result = evaluateAttempt(
    { title: "Parking Lot" },
    { design: "ParkingLot owns spaces and handles entry flow.", relationships: "", tradeoffs: "" }
  );
  assert.ok(result.score > 0 && result.score < 100);
  assert.equal(result.status, "needs-work");
  assert.ok(result.criteria.some((criterion) => criterion.id === "relationships" && criterion.score === 0));
  assert.ok(result.nextSteps.length > 0);
});

test("criteria scores are capped for repeated keywords", () => {
  const result = evaluateAttempt(
    { title: "Elevator" },
    {
      design: "Responsibility responsibility owns responsibility handles responsibility.",
      relationships: "Association uses composition depends on relationship.",
      tradeoffs: ""
    }
  );
  assert.equal(result.criteria.find((criterion) => criterion.id === "responsibilities").score, 100);
  assert.ok(result.criteria.every((criterion) => criterion.score <= 100));
});

function assertCriterionRecognizesParaphrases(criterionId, answers) {
  for (const { problem, answer } of answers) {
    const result = evaluateAttempt(problem, { design: answer });
    const criterion = result.criteria.find((item) => item.id === criterionId);
    assert.equal(criterion.score, 100, `${problem.title}: ${answer}`);
  }
}

test("responsibilities recognizes paraphrased component ownership", () => {
  assertCriterionRecognizesParaphrases("responsibilities", [
    { problem: { title: "Parking Lot" }, answer: "The gate assigns a space; the ticket records arrival time." },
    { problem: { title: "Elevator" }, answer: "The lift controller manages calls while each car tracks its current floor." },
    { problem: { title: "Vending Machine" }, answer: "Inventory maintains item counts and the payment service validates funds." }
  ]);
});

test("relationships recognizes collaboration described without relationship jargon", () => {
  assertCriterionRecognizesParaphrases("relationships", [
    { problem: { title: "Parking Lot" }, answer: "The gate asks the lot to reserve a space; each ticket belongs to one vehicle." },
    { problem: { title: "Elevator" }, answer: "The dispatcher calls a car, and the car notifies the controller when it arrives." },
    { problem: { title: "Vending Machine" }, answer: "The machine calls the payment processor; the dispenser collaborates with inventory." }
  ]);
});

test("extensibility recognizes variation and decoupling language", () => {
  assertCriterionRecognizesParaphrases("extensibility", [
    { problem: { title: "Parking Lot" }, answer: "A new vehicle can plug into the spot-matching rule without changing the lot." },
    { problem: { title: "Elevator" }, answer: "We can swap in a new dispatch policy while keeping the controller decoupled." },
    {
      problem: { title: "Vending Machine" },
      answer: "State implements a common interface so a new PaymentMethod can be added without changing VendingMachine itself."
    }
  ]);
});

test("behavior recognizes ordinary sequences and state transitions", () => {
  assertCriterionRecognizesParaphrases("behavior", [
    { problem: { title: "Parking Lot" }, answer: "At entry the gate assigns a space, then prints a ticket; at exit it releases the space." },
    { problem: { title: "Elevator" }, answer: "After a floor call, the car moves to that floor; doors open before passengers board, then close." },
    { problem: { title: "Vending Machine" }, answer: "After payment the machine dispenses the item; if delivery fails, it returns to Idle." }
  ]);
});

test("edge cases recognize recovery, rejection, refunds, and unavailable resources", () => {
  assertCriterionRecognizesParaphrases("edgeCases", [
    { problem: { title: "Parking Lot" }, answer: "When every space is occupied, reject the next arrival because there is no capacity." },
    { problem: { title: "Elevator" }, answer: "If a car cannot reach a floor, mark the request unavailable and let another car recover it." },
    {
      problem: { title: "Vending Machine" },
      answer: "If funds are insufficient, State transitions back to HasMoney with a message instead of dispensing. If change can't be made exactly, the machine refunds and returns to Idle rather than dispensing without change."
    }
  ]);
});
