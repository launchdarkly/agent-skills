---
name: launchdarkly-experiment-hypothesis-builder
description: "Help a user craft a strong, testable LaunchDarkly experiment hypothesis and extract the structured fields (intervention, primary metric + direction, expected effect, guardrails, audience) needed to auto-scaffold the rest of the experiment. Use when a user is starting an experiment from an idea/goal, or wants to sharpen a weak hypothesis before setup."
compatibility: Requires the remotely hosted LaunchDarkly MCP server. Pairs with launchdarkly-experiment-setup, which it hands off to.
license: Apache-2.0
metadata:
  author: launchdarkly
  version: "0.1.0"
  status: draft
---

# LaunchDarkly Experiment Hypothesis Builder

> **Status: draft.** Early version, published for review. Behavior and the handoff contract may change.

Your job is to turn a user's rough idea into a **strong, testable hypothesis** and a **structured extraction** that lets the rest of the experiment be created for them. The hypothesis is the best starting point: a well-formed one encodes both the intervention (→ flag + treatments) and the outcome (→ metric), so everything downstream can be scaffolded or selected with minimal further questions.

This skill produces two artifacts:
1. A polished **hypothesis string** for the experiment.
2. A **structured JSON extraction** that hands off to `launchdarkly-experiment-setup` (which otherwise assumes the hypothesis is already known).

## Anatomy of a strong hypothesis

A strong hypothesis names six elements. Use this as the rubric:

| # | Element | Question it answers | Feeds experiment field |
|---|---------|--------------------|------------------------|
| 1 | **Intervention** | What specific change are we making? | Flag + treatments (control vs. variant) |
| 2 | **Audience** | Who sees it? / how are they split? | Targeting rule + randomization unit |
| 3 | **Primary metric** | What single number defines success? | `primarySingleMetricKey` |
| 4 | **Direction** | Should it go up or down? | Metric `successCriteria` |
| 5 | **Expected effect** | By roughly how much? | Powering / sample-size, analysis config |
| 6 | **Rationale + guardrails** | Why do we expect this? What must NOT get worse? | Secondary/guardrail metrics |

**Canonical template:**
> *If we **[intervention]** for **[audience]**, then **[primary metric]** will **[direction]** by **[~magnitude]**, because **[rationale]** — while **[guardrail metric]** stays flat.*

**Three quality checks beyond the six elements** (a hypothesis can have all six and still be broken):
- **Falsifiable** — there is a result that would prove it wrong. "Will do better or as well" and "figure out which resonates" fail this.
- **Single-variable** — exactly one thing differs between control and treatment; bundled changes destroy attribution.
- **Grounded** — tied to the observed usage data that prompted it, not just a hunch.

## Coach to the common gaps

Weak hypotheses tend to fail in predictable ways. Prioritize eliciting the rarest, highest-value elements first:

- **A measurable metric is the #1 gap** — without a concrete primary metric nothing downstream can auto-select or create it. **Always** pin one down.
- **Magnitude is almost never stated.** Ask for a rough number (even "~3–5%"); it's needed for powering.
- **Rationale ("because…") is rare.** The "why" sharpens the design and helps reviewers.
- Direction and if/then structure are the easier wins — scaffold structure and confirm direction.

Prioritize eliciting **metric → magnitude → rationale**, in that order. Most drafts need active coaching, not rubber-stamping. When a user's outcome is vague, suggest a concrete primary metric — conversion is by far the most common in practice, followed by engagement, clicks, and signups.

## Workflow

### Step 1 — Capture the raw input
Accept whatever the user starts with: a free-text idea, a goal, a flag they already have, or a metric they care about. Don't require structure yet.

### Step 2 — Diagnose by flaw type, then score
First check which of the six elements are present. Then diagnose **flaw type**, because the corrective move differs by flaw. A hypothesis usually has several. The full branch-by-branch decision tree — diagnosis → correction → flag/variations/metrics/guardrails → config summary — is in `references/diagnostic-tree.md`; **read it when a hypothesis is weak or you're configuring the experiment.** The flaw taxonomy:

| Flaw | Tell | Correction move |
|------|------|-----------------|
| **Vague/absent intervention** | names a goal, not a change ("increase revenue") | force a specific control vs. treatment |
| **No measurable metric** | outcome is an adjective ("better performance") | operationalize into one primary metric + direction |
| **Missing causal mechanism** | no "because" | add the *why*; if none, question testing it |
| **Not falsifiable** | "will do better or as well", "figure out which resonates", tautology | commit to a directional, disconfirmable prediction + decision rule |
| **Conflates multiple variables** | bundles changes ("colors + typography + hero") | isolate to one variable, or label as a package test with attribution caveat |
| **Not grounded in usage data** | asserts a problem with no evidence | tie to the observed signal; if none, mark assumption-driven |
| **Metric ↔ outcome mismatch** | predicts engagement but measures revenue | align primary metric to the *predicted* outcome |

Classify overall:
- **Strong** — specific single-variable change + primary metric + direction, falsifiable (+ ideally magnitude/rationale). Proceed; only confirm.
- **Serviceable** — has intervention + direction but no concrete metric or magnitude, or a fixable flaw. Fill the gaps.
- **Weak** — vague goal / no measurable outcome / untestable (e.g. "Better engagement", "Increase revenue"). Rebuild from questions.

### Step 3 — Ask ONLY for the missing high-value elements
Keep it to the fewest questions. Lead with the rarest gaps: **primary metric + direction**, then **magnitude**, then **rationale/guardrails**, then **audience** if unclear. Offer concrete options where you can (e.g. suggest plausible metrics based on the intervention). Don't interrogate — 1–3 targeted questions is the target.

### Step 4 — Compose the polished hypothesis
Write one clear sentence using the canonical template. Keep the user's intent and voice; don't invent specifics they didn't confirm. Flag any assumption you had to make.

### Step 5 — Emit the structured extraction
Return this JSON so downstream setup can proceed:

```json
{
  "hypothesis": "polished single-sentence hypothesis",
  "intervention": {
    "summary": "what changes",
    "control": "current experience",
    "treatment": "new experience",
    "flag_candidate_terms": ["stemmed", "synonym", "search", "terms"]
  },
  "primary_metric": {
    "name": "human name of the success metric",
    "direction": "increase | decrease",
    "metric_candidate_terms": ["stemmed", "synonym", "search", "terms"]
  },
  "secondary_metrics": ["..."],
  "guardrail_metrics": ["metrics that must not regress"],
  "expected_effect": { "magnitude": "e.g. +5% (or null if unknown)", "known": true },
  "audience": { "targeting": "who / how split", "randomization_unit": "user" },
  "rationale": "why we expect this",
  "quality": { "score": "0-6", "missing_elements": ["..."] }
}
```

### Step 6 — Generate search terms for matching existing flags/metrics
LaunchDarkly's `list-flags` / `list-metrics` `query` is **literal case-insensitive substring matching, not semantic** — e.g. `"completion"` does NOT match a metric named `"completed"`, and `"create"` does NOT match `"creation"`. So **do not** pass the hypothesis text verbatim to search. For each of `flag_candidate_terms` and `metric_candidate_terms`, emit several **stemmed / truncated / synonym** variants (e.g. `creation` → `creat`, `create`, `creation`; `completion` → `complet`, `completed`, `complete`), run multiple queries, union + dedupe, then rank candidates by name + description + tags and **confirm the pick with the user** (near-decoys often rank alongside the target).

### Step 7 — Resolve flag & metric keys (select-or-create)
Turn the candidate *terms* into concrete LD **keys**, because `launchdarkly-experiment-setup` needs a real `flagKey` (and its variation IDs), not a name. First establish `projectKey` and `environmentKey` (ask if not already known; default env `production`). Then:
- **Flag:** run the expanded `flag_candidate_terms` through `list-flags`; if a confirmed match exists, record its key with `action: use_existing`. Otherwise plan a boolean flag (`control` = off/current, `treatment` = on/changed) with `action: create` and a proposed kebab-case key naming the *toggle* (not the outcome).
- **Primary metric:** run `metric_candidate_terms` through `list-metrics`; on a confirmed match record its key + `action: use_existing`; else plan `action: create` with `measureType` (occurrence/count/value) and `successCriteria` derived from `direction`.
- **Guardrail/secondary metrics:** resolve the same way (guardrails usually already exist — latency, error rate, refunds).
- Confirm every pick with the human (near-decoys rank alongside targets). Record the resolved keys + actions in the handoff payload (Step 9). **Do not create anything here** — `launchdarkly-experiment-setup` owns all writes, flag-version ordering, and event-health checks.

### Step 8 — Check MDE / sample size, then print the configuration summary
Before setup, sanity-check power: from the expected magnitude, smaller lift → larger sample / longer runtime. If the primary metric's baseline volume can't reach significance for the stated effect in a reasonable window, say so and either raise the target effect, pick a higher-volume metric, or extend runtime. Watch guardrails and one primary metric to control false positives.

Always end with this configuration summary:

```
Hypothesis:      If we [change] for [audience], then [primary metric] will [direction]
                 by [~magnitude], because [mechanism] — while [guardrail] stays flat.
Flag:            <flag-key>  (boolean | multivariate)
Variations:      Control  = <specific current experience>
                 Treatment = <specific changed experience>
Primary metric:  <metric>  (higher/lower is better)
Guardrail(s):    <metric(s) that must not regress>
Sample/runtime:  <MDE> → ~<n per arm> / ~<days> at current volume
```

### Step 9 — Hand off to `launchdarkly-experiment-setup`
After the human approves the configuration summary, invoke `launchdarkly-experiment-setup` with this **handoff payload**. The payload is pre-resolved so that skill can skip discovery and go near-straight to its Step 3 `create-experiment` call.

```json
{
  "handoffFrom": "launchdarkly-experiment-hypothesis-builder",
  "projectKey": "...",
  "environmentKey": "production",
  "hypothesis": "polished single-sentence hypothesis",
  "description": "plain-language description of the change being tested",
  "methodology": "bayesian",
  "primarySingleMetricKey": "resolved-primary-metric-key",
  "metrics": [
    { "key": "resolved-primary-metric-key", "role": "primary", "measureType": "occurrence|count|value", "successCriteria": "HigherThanBaseline|LowerThanBaseline", "action": "use_existing|create" },
    { "key": "guardrail-metric-key", "role": "guardrail", "successCriteria": "...", "action": "use_existing|create" }
  ],
  "flag": {
    "key": "resolved-or-proposed-flag-key",
    "action": "use_existing | create",
    "kind": "boolean | multivariate",
    "ruleId": "fallthrough",
    "controlVariationId": "id-of-control-variation-or-null-until-created",
    "treatmentVariationId": "id-of-treatment-variation-or-null-until-created"
  },
  "treatments": [
    { "name": "Control",   "baseline": true,  "allocationPercent": 50, "experience": "specific current experience" },
    { "name": "Treatment", "baseline": false, "allocationPercent": 50, "experience": "specific changed experience" }
  ],
  "randomizationUnit": "user | request | organization | device",
  "expectedEffect": "+5%",
  "mdeNote": "at current volume, ~N/arm / ~D days to detect this effect",
  "quality": { "score": "0-6", "missing_elements": [] }
}
```

**How `launchdarkly-experiment-setup` consumes it** (map onto its own steps — don't re-derive what's provided):
- **Step 1 (Prepare Metrics):** metrics with `action: use_existing` are already resolved — just verify with `list-metric-events`; `action: create` → `create-metric` using the given `measureType`/`successCriteria`. `primarySingleMetricKey` is set.
- **Step 2 (Targeting rule):** `flag.action: create` → `create-flag` (boolean: control=off, treatment=on), then read variation IDs; `use_existing` → `get-flag` to fill `controlVariationId`/`treatmentVariationId`. Toggle the flag on **before** the final `get-flag`, then use that env `version` as `flagConfigVersion` (version-ordering discipline).
- **Step 3 (Create):** assemble `treatments[].parameters` from the flag key + resolved variation IDs; pass `hypothesis`, `metrics`, `primarySingleMetricKey`, `randomizationUnit`, `methodology`.
- Treat everything as **pre-approved proposals**, not silent auto-writes: still confirm with the human and surface event health before creating. Anything the payload leaves null (e.g. variation IDs before creation), resolve in-flow.

## Scoring examples

**Strong** (ready to build):
> "If we align the navigation to the left, then signup conversion rate will increase by improving scannability and reducing cognitive load, while login success rate remains unchanged."
- ✅ intervention, ✅ primary metric (signup conversion), ✅ direction, ✅ rationale, ✅ guardrail (login success). Only missing an explicit magnitude — ask once, then build.

**Serviceable** (fill 1–2 gaps):
> "Mini charts on the screener page will increase trades."
- Has intervention + direction + metric (trades). Missing magnitude, rationale, audience. Ask: expected lift? why? which users?

**Weak** (rebuild via questions):
> "Better engagement." / "Increase revenue."
- No change, no concrete metric. Ask: what specific change? engagement/revenue measured how (metric)? for whom? expected direction and size?

## Detecting low-effort / non-real input

Some entries are platform tests, not experiments. If the input looks like one, gently confirm intent rather than building a hypothesis. Common signals:
- Placeholders / gibberish: "If X then Y", "this is a test", "ABC", "asdf", single words.
- Platform self-tests: "testing the LaunchDarkly platform", "A/A test to validate bucketing", "dummy flag", "just for dev env".
- Meta: "I have to fill this out to delete the experiment."

Note: a hypothesis that merely mentions "A/B test" or "test group" as part of a real idea is fine — only filter genuine platform/self-tests.

## What NOT to do

- Don't accept a vague goal as a hypothesis — a hypothesis without a measurable primary metric can't drive an experiment.
- Don't invent a metric, magnitude, or audience the user didn't confirm; surface assumptions instead.
- Don't pass raw hypothesis text to flag/metric search — expand into stemmed/synonym query terms first.
- Don't over-interrogate. Lead with the rarest, highest-value gaps (metric, magnitude, rationale) and cap at ~3 questions.
- Don't write to LaunchDarkly without human confirmation of the final hypothesis and the flag/metric picks.
