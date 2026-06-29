const { test } = require("node:test");
const assert = require("node:assert/strict");

const outputValid = require("../shared/output-valid");

test("passes for a plain object", () => {
  const r = outputValid({ response: "hello" });
  assert.equal(r.pass, true);
  assert.equal(r.score, 1);
});

test("passes for an empty object", () => {
  const r = outputValid({});
  assert.equal(r.pass, true);
  assert.equal(r.score, 1);
});

test("fails for a raw string (unparsed output)", () => {
  const r = outputValid("not an object");
  assert.equal(r.pass, false);
  assert.equal(r.score, 0);
});

test("fails for null", () => {
  const r = outputValid(null);
  assert.equal(r.pass, false);
  assert.equal(r.score, 0);
});

test("fails for undefined", () => {
  const r = outputValid(undefined);
  assert.equal(r.pass, false);
  assert.equal(r.score, 0);
});

test("fails for a number", () => {
  const r = outputValid(42);
  assert.equal(r.pass, false);
  assert.equal(r.score, 0);
});

test("result always includes a reason string", () => {
  assert.equal(typeof outputValid({}).reason, "string");
  assert.equal(typeof outputValid("bad").reason, "string");
});
