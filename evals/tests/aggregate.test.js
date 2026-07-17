const { test } = require("node:test");
const assert = require("node:assert/strict");

const { summarize } = require("../scripts/aggregate");

// Build a promptfoo-shaped results object from [{description, success, score?}].
// promptfoo stores the fixture description under testCase.description (the
// top-level `description` is null), so mirror that shape here.
function makeResults(rows) {
  return {
    results: {
      results: rows.map((r) => ({
        success: r.success,
        score: r.score,
        description: null,
        testCase: { description: r.description },
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// known-red tolerance
// ---------------------------------------------------------------------------

test("known-red failing fixture is excluded from the gate but still reported", () => {
  const suite = { skillKey: "x", knownRed: ["held prod"] };
  const results = makeResults([
    { description: "happy path", success: true },
    { description: "held prod", success: false },
  ]);
  const s = summarize(suite, results, "abc123");

  // honest reporting keeps the red visible
  assert.equal(s.passed, 1);
  assert.equal(s.total, 2);
  assert.equal(s.score, 50);
  assert.equal(s.status, "failing");

  // gate ignores the known-red fixture, so it passes
  assert.equal(s.gateScore, 100);
  assert.deepEqual(s.knownRed, ["held prod"]);
  assert.deepEqual(s.unexpectedGreen, []);
});

test("an unexpected (non-known-red) failure still fails the gate", () => {
  const suite = { skillKey: "x", knownRed: ["held prod"] };
  const results = makeResults([
    { description: "happy path", success: false },
    { description: "held prod", success: false },
  ]);
  const s = summarize(suite, results, "abc123");
  assert.equal(s.gateScore, 0); // only the non-known-red test counts; it failed
});

test("a known-red fixture that starts passing is surfaced as unexpectedGreen", () => {
  const suite = { skillKey: "x", knownRed: ["held prod"] };
  const results = makeResults([
    { description: "happy path", success: true },
    { description: "held prod", success: true },
  ]);
  const s = summarize(suite, results, "abc123");
  assert.equal(s.score, 100);
  assert.equal(s.gateScore, 100);
  assert.deepEqual(s.unexpectedGreen, ["held prod"]);
});

test("suites without a knownRed list behave as before", () => {
  const suite = { skillKey: "x" };
  const results = makeResults([
    { description: "a", success: true },
    { description: "b", success: false },
  ]);
  const s = summarize(suite, results, null);
  assert.equal(s.score, 50);
  assert.equal(s.gateScore, 50);
  assert.deepEqual(s.knownRed, []);
  assert.deepEqual(s.unexpectedGreen, []);
});

test("all-known-red suite has an empty gate that passes (gateScore 100)", () => {
  const suite = { skillKey: "x", knownRed: ["a", "b"] };
  const results = makeResults([
    { description: "a", success: false },
    { description: "b", success: false },
  ]);
  const s = summarize(suite, results, null);
  assert.equal(s.score, 0);
  assert.equal(s.gateScore, 100);
});
