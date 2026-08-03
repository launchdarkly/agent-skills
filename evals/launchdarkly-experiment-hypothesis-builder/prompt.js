/**
 * Prompt function for this suite: returns SKILL.md wrapped in nunjucks `{% raw %}`.
 *
 * Why this exists. promptfoo renders every prompt through nunjucks, and this skill's
 * SKILL.md documents its own placeholder-hole syntax — `{{measurement:...}}`,
 * `{{component:hint}}` — in the output-contract examples. Nunjucks parses `measurement`
 * as a variable, hits the `:`, and throws "expected variable end", which errors all 5
 * tests in this suite before a single API call is made.
 *
 * Why wrap rather than return the file as-is. A function prompt does NOT skip the
 * nunjucks pass: promptfoo's renderPrompt assigns the function's return value to
 * basePrompt and still calls nunjucks.renderString on it. Its own escape hatch,
 * autoWrapRawIfPartialNunjucks, only fires on *unclosed* tags (`{{` with no `}}`), so
 * closed-but-invalid expressions like `{{measurement:...}}` sail through unprotected.
 * Wrapping here supplies the `{% raw %}` that helper would have added. renderString then
 * returns the file byte-for-byte, so results.json still shows the exact skill text.
 * The tags live only in this in-memory prompt — SKILL.md on disk is untouched, keeping
 * the hole syntax byte-identical to the o11y `experiment-hypothesis` contract.
 *
 * The prompt is not what the agent under test sees. The provider discards it
 * (claude-skill-agent-sdk.js — `callApi(_prompt, context)`), loads the skill from disk
 * into `.claude/skills/<slug>/`, and builds the user turn from vars.user_request. This
 * exists to satisfy promptfoo's requirement that a prompt be defined.
 *
 * Deliberately suite-local rather than in evals/shared/: shared/ is a GLOBAL_TRIGGERS
 * entry in scripts/_manifest.js, so a file there forces every suite to re-run.
 */
const fs = require("node:fs");
const path = require("node:path");

const SKILL_MD = path.resolve(
  __dirname,
  "../../skills/experiments/launchdarkly-experiment-hypothesis-builder/SKILL.md",
);

module.exports = () => `{% raw %}${fs.readFileSync(SKILL_MD, "utf-8")}{% endraw %}`;
