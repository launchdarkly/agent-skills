# Auto-release: automated rollout configs & release policies

This is the mechanism behind the "release" half of the skill. The goal: once the PR
merges and the guarding flag starts evaluating, the change rolls out **on its own**,
the way the team has decided similar changes should roll out — no human toggling a flag.

## The pieces

- **Flag** — the boolean gate you created (OFF everywhere). Nothing happens to users until a release turns it on.
- **Release policy** — a project-level rule that says *how* a matching flag should be released in a given environment: immediately, progressively (staged %), or as a guarded rollout with metrics and auto-rollback. Policies match on criteria like environment and flag tags, and can auto-attach the metrics a guarded rollout should watch.
- **Automated rollout config** — the per-flag, per-PR record (created by `create-automated-rollout-config`) that ties the flag to the merge and says, per environment, whether to release immediately (`simple`) or to defer to the environment's release policy (`policy`).

## `simple` vs `policy`

`create-automated-rollout-config` takes an `environments` array; each entry is
`{ environmentKey, releaseType }`.

- **`simple`** (default): serve `true` in that environment as soon as the config is created. Because a freshly created flag isn't evaluated anywhere yet, this is effectively a no-op until the merged code ships — then that environment is simply "on." Use it for dev/staging environments you want fully enabled without ceremony.

- **`policy`**: wait until the PR merges and the flag begins evaluating, then resolve that environment's configured release policy and perform the matching release — immediate, progressive, or guarded — automatically. Use it for production and any environment where you want a governed, monitored rollout with the safety net the team already defined.

A typical plan: `staging → simple`, `production → policy`.

## Preview before you propose

Always call `match-release-policies` before recommending a `policy` environment, so you
(and the user) know what `policy` will actually do:

- **Before the flag exists** — pass `projectKey`, `environmentKey`, and the proposed `flagTags`. This does client-side matching against the project's policies and previews the winner.
- **After the flag exists** — pass `projectKey`, `environmentKey`, and `flagKey`. This hits the server-side release-settings endpoint and returns the authoritative resolved policy.

It returns the `winningPolicy`, the `winningReleaseMethod` (immediate / progressive / guarded), and any `autoAttachedMetricKeys` / `autoAttachedMetricGroupKeys`. Use `list-release-policies` to see every policy in the project and what each attaches.

**If nothing matches**, `policy` falls back to project defaults (often an immediate release). Tell the user — they may want to pick `simple` instead, or set up a release policy first.

## Precedence

When a `policy` environment resolves what to do on merge, precedence is:

**explicit overrides → matched release policy → project/demo defaults**

So an operator override wins over the policy, and the policy wins over the fallback default.
You generally don't set overrides from this skill; you rely on the policy, which is why
previewing it matters.

## Registering the config

Call `create-automated-rollout-config` in the implement phase:

```json
{
  "projectKey": "default",
  "flagKey": "new-checkout-flow",
  "environments": [
    { "environmentKey": "staging", "releaseType": "simple" },
    { "environmentKey": "production", "releaseType": "policy" }
  ],
  "repoFullName": "acme/storefront",
  "prNumber": 482
}
```

The guarding flag must already exist. Provide the PR reference (`repoFullName` + `prNumber`,
or `prUrl`) so the rollout is bound to the right merge. The call returns `created`,
`config_id`, and the normalized per-environment plan — record `config_id` in your report.

## Relationship to guarded rollouts

When a `policy` environment resolves to a **guarded** release method, the merge triggers the
same kind of progressive, metric-monitored rollout described in the
[`launchdarkly-guarded-rollout`](../../launchdarkly-guarded-rollout/SKILL.md) skill — the
difference is that here it's driven automatically by the policy on merge, rather than started
by hand. If a change needs a *bespoke* rollout that no policy expresses, set that environment
to `simple` here and drive the guarded rollout manually with that skill after merge.
