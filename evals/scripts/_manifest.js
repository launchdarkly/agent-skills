/**
 * Single source of truth mapping eval suites to the skills they cover.
 *
 * Used by:
 *   - scripts/aggregate.js           (runs suites, emits eval-scores.json)
 *   - scripts/diff-changed-skills.js (decides which suites to re-run in CI)
 *   - scripts/render-badges.js       (writes per-skill README badges)
 *
 * Field meanings:
 *   suite    - directory under evals/ containing promptfooconfig.yaml
 *   skillKey - identifier used in eval-scores.json and README badges
 *   skillDir - path from repo root to the skill source directory
 *   readme   - skill README path from repo root for badge rendering
 */
const SUITES = [
  {
    suite: "configs-create",
    skillKey: "agentcontrol/configs-create",
    skillDir: "skills/agentcontrol/configs-create",
    readme: "skills/agentcontrol/configs-create/README.md",
  },
  {
    suite: "configs-update",
    skillKey: "agentcontrol/configs-update",
    skillDir: "skills/agentcontrol/configs-update",
    readme: "skills/agentcontrol/configs-update/README.md",
  },
  {
    suite: "agentcontrol-tools",
    skillKey: "agentcontrol/tools",
    skillDir: "skills/agentcontrol/tools",
    readme: "skills/agentcontrol/tools/README.md",
  },
  {
    suite: "configs-variations",
    skillKey: "agentcontrol/configs-variations",
    skillDir: "skills/agentcontrol/configs-variations",
    readme: "skills/agentcontrol/configs-variations/README.md",
  },
  {
    suite: "launchdarkly-flag-create",
    skillKey: "feature-flags/launchdarkly-flag-create",
    skillDir: "skills/feature-flags/launchdarkly-flag-create",
    readme: "skills/feature-flags/launchdarkly-flag-create/README.md",
  },
];

/**
 * Paths that, when changed, invalidate every suite (force re-run all).
 * Relative to repo root.
 */
const GLOBAL_TRIGGERS = [
  "evals/providers",
  "evals/shared",
  "evals/tools",
  "evals/mocks",
];

module.exports = { SUITES, GLOBAL_TRIGGERS };
