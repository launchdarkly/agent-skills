/**
 * Single source of truth for the agent (system-under-test) model aliases used
 * by the `eval:haiku`, `eval:sonnet`, `eval:opus`, and `eval:matrix` npm
 * scripts (which delegate to `scripts/run-models.js`).
 *
 * Edit the right-hand side here when newer Anthropic models ship; nothing
 * else in the repo needs to change. To run an unmapped model id directly:
 *
 *   node scripts/run-models.js --model=claude-something-newer-2026
 *
 * Notes:
 *  - These IDs are the raw Anthropic model strings consumed by
 *    @anthropic-ai/claude-agent-sdk via AGENT_MODEL — NOT the
 *    `provider:type:model` strings promptfoo uses for its own LLM rubric
 *    grader (RUBRIC_MODEL). Don't confuse the two formats.
 *  - The rubric grader (RUBRIC_MODEL) is configured separately in `.env`
 *    and stays on a cheap model regardless of which agent model you pick.
 */
const MODEL_ALIASES = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-20250514",
  opus: "claude-opus-4-20250514",
};

/**
 * Resolve a CLI argument (alias or raw model id) to the model id sent to
 * the Anthropic API. Unknown values pass through untouched so users can
 * point at a freshly-released model without editing this file.
 */
function resolveModel(input) {
  if (!input) return null;
  const trimmed = String(input).trim();
  return MODEL_ALIASES[trimmed] || trimmed;
}

/**
 * Reverse-lookup a friendly alias for an arbitrary model id, falling back
 * to the model id itself. Used to label per-model output files like
 * `aiconfig-create/results.haiku.json`.
 */
function aliasFor(modelId) {
  for (const [alias, id] of Object.entries(MODEL_ALIASES)) {
    if (id === modelId) return alias;
  }
  return modelId;
}

module.exports = { MODEL_ALIASES, resolveModel, aliasFor };
