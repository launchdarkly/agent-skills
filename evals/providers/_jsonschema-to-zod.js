/**
 * Tiny JSON Schema -> Zod converter, scoped to the subset used by
 * tools/definitions.json: type, properties, required, items, enum,
 * description. Built so that the SDK provider can register the same tool
 * surface as the legacy provider without hand-writing Zod schemas for every
 * LaunchDarkly MCP tool.
 *
 * `inputSchemaToZodShape()` returns a raw Zod shape (object whose values are
 * Zod schemas) so callers can spread it into the SDK's `tool()` helper.
 * Anything unrecognised falls through to `z.any()`.
 */

const { z } = require("zod");

function fieldToZod(field) {
  if (!field || typeof field !== "object") return z.any();

  if (Array.isArray(field.enum) && field.enum.length > 0) {
    const values = field.enum.filter((v) => typeof v === "string");
    if (values.length === field.enum.length) {
      let s = z.enum(values);
      if (field.description) s = s.describe(field.description);
      return s;
    }
  }

  let base;
  switch (field.type) {
    case "string":
      base = z.string();
      break;
    case "integer":
      base = z.number().int();
      break;
    case "number":
      base = z.number();
      break;
    case "boolean":
      base = z.boolean();
      break;
    case "array":
      base = z.array(field.items ? fieldToZod(field.items) : z.any());
      break;
    case "object": {
      const shape = {};
      const required = new Set(
        Array.isArray(field.required) ? field.required : [],
      );
      for (const [k, v] of Object.entries(field.properties || {})) {
        const inner = fieldToZod(v);
        shape[k] = required.has(k) ? inner : inner.optional();
      }
      base = z.object(shape).passthrough();
      break;
    }
    default:
      base = z.any();
  }

  if (field.description) base = base.describe(field.description);
  return base;
}

/**
 * Convert a JSON Schema describing a tool's `input_schema` into a Zod raw
 * shape ready to spread into the SDK's `tool(...)` helper. Required fields
 * stay required; everything else becomes optional.
 */
function inputSchemaToZodShape(schema) {
  if (!schema || schema.type !== "object" || !schema.properties) {
    return {};
  }
  const required = new Set(
    Array.isArray(schema.required) ? schema.required : [],
  );
  const shape = {};
  for (const [k, v] of Object.entries(schema.properties)) {
    const inner = fieldToZod(v);
    shape[k] = required.has(k) ? inner : inner.optional();
  }
  return shape;
}

module.exports = { inputSchemaToZodShape, fieldToZod };
