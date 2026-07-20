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
 *   knownRed - (optional) test `description`s that are intentionally red: they
 *              encode a tracked capability gap in the default SUT and MUST stay
 *              red until the skill or the model closes it. aggregate.js excludes
 *              them from the CI gate (so an intentional red doesn't fail the job)
 *              while still reporting the honest score/badge. The assertion itself
 *              is never weakened. If a listed fixture starts passing, aggregate.js
 *              warns so the entry can be removed.
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
  {
    suite: "launchdarkly-flag-command",
    skillKey: "feature-flags/launchdarkly-flag-command",
    skillDir: "skills/feature-flags/launchdarkly-flag-command",
    readme: "skills/feature-flags/launchdarkly-flag-command/README.md",
  },
  {
    suite: "should-flag-change",
    skillKey: "feature-flags/should-flag-change",
    skillDir: "skills/feature-flags/should-flag-change",
    readme: "skills/feature-flags/should-flag-change/README.md",
  },
  {
    suite: "flag-release",
    skillKey: "feature-flags/flag-release",
    skillDir: "skills/feature-flags/flag-release",
    readme: "skills/feature-flags/flag-release/README.md",
    // Tracked capability gap: claude-sonnet-4-6 (default SUT) wrongly records a
    // held production environment as `policy` (which auto-releases on merge),
    // shipping before the hold date. claude-opus-4-8 gets it right, so the
    // behavior is achievable and the assertion is correct as written. See the
    // KNOWN-RED note in evals/flag-release/promptfooconfig.yaml.
    knownRed: [
      "Hold intent: records staging on merge but holds production, honoring the stated hold",
    ],
  },
  {
    suite: "flag-and-release-change",
    skillKey: "feature-flags/flag-and-release-change",
    skillDir: "skills/feature-flags/flag-and-release-change",
    readme: "skills/feature-flags/flag-and-release-change/README.md",
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
