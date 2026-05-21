const { test } = require("node:test");
const assert = require("node:assert/strict");

const { inputSchemaToZodShape, fieldToZod } = require("../providers/_jsonschema-to-zod");
const { z } = require("zod");

// ---------------------------------------------------------------------------
// fieldToZod
// ---------------------------------------------------------------------------

test("string field parses a string", () => {
  const schema = fieldToZod({ type: "string" });
  assert.doesNotThrow(() => schema.parse("hello"));
  assert.throws(() => schema.parse(42));
});

test("integer field parses integers and rejects floats", () => {
  const schema = fieldToZod({ type: "integer" });
  assert.doesNotThrow(() => schema.parse(3));
  assert.throws(() => schema.parse(3.14));
});

test("number field parses floats", () => {
  const schema = fieldToZod({ type: "number" });
  assert.doesNotThrow(() => schema.parse(3.14));
});

test("boolean field parses booleans", () => {
  const schema = fieldToZod({ type: "boolean" });
  assert.doesNotThrow(() => schema.parse(true));
  assert.throws(() => schema.parse("true"));
});

test("array field parses arrays", () => {
  const schema = fieldToZod({ type: "array", items: { type: "string" } });
  assert.doesNotThrow(() => schema.parse(["a", "b"]));
  assert.throws(() => schema.parse([1, 2]));
});

test("array without items accepts any element", () => {
  const schema = fieldToZod({ type: "array" });
  assert.doesNotThrow(() => schema.parse([1, "two", true]));
});

test("object field with required and optional properties", () => {
  const schema = fieldToZod({
    type: "object",
    properties: {
      name: { type: "string" },
      count: { type: "integer" },
    },
    required: ["name"],
  });
  // required field present
  assert.doesNotThrow(() => schema.parse({ name: "foo" }));
  // optional field absent — ok
  assert.doesNotThrow(() => schema.parse({ name: "foo" }));
  // required field absent — fails
  assert.throws(() => schema.parse({ count: 1 }));
});

test("object field uses passthrough for unknown keys", () => {
  const schema = fieldToZod({
    type: "object",
    properties: { name: { type: "string" } },
    required: ["name"],
  });
  const result = schema.parse({ name: "foo", extra: "bar" });
  assert.equal(result.extra, "bar");
});

test("enum field with all-string values", () => {
  const schema = fieldToZod({ enum: ["a", "b", "c"] });
  assert.doesNotThrow(() => schema.parse("a"));
  assert.throws(() => schema.parse("d"));
});

test("mixed-type enum falls back to base type handling", () => {
  // mixed enum (string + number) does not produce a z.enum, falls through to type handling
  const schema = fieldToZod({ enum: ["a", 1], type: "string" });
  // should fall through to z.string()
  assert.doesNotThrow(() => schema.parse("anything"));
});

test("description is attached when provided", () => {
  const schema = fieldToZod({ type: "string", description: "A label" });
  assert.equal(schema.description, "A label");
});

test("unknown type falls back to z.any()", () => {
  const schema = fieldToZod({ type: "banana" });
  assert.doesNotThrow(() => schema.parse(42));
  assert.doesNotThrow(() => schema.parse("foo"));
});

test("null/undefined input falls back to z.any()", () => {
  assert.doesNotThrow(() => fieldToZod(null).parse("anything"));
  assert.doesNotThrow(() => fieldToZod(undefined).parse(42));
});

// ---------------------------------------------------------------------------
// inputSchemaToZodShape
// ---------------------------------------------------------------------------

test("converts a top-level input_schema to a Zod shape", () => {
  const shape = inputSchemaToZodShape({
    type: "object",
    properties: {
      projectKey: { type: "string" },
      limit: { type: "integer" },
    },
    required: ["projectKey"],
  });
  // required field present
  assert.doesNotThrow(() => shape.projectKey.parse("my-project"));
  // optional field
  assert.doesNotThrow(() => shape.limit.parse(undefined));
  // required field rejects wrong type
  assert.throws(() => shape.projectKey.parse(42));
});

test("returns empty shape for non-object schema", () => {
  assert.deepEqual(inputSchemaToZodShape(null), {});
  assert.deepEqual(inputSchemaToZodShape({ type: "string" }), {});
  assert.deepEqual(inputSchemaToZodShape({}), {});
});
