# Hypothesis Diagnostic Decision Tree

Organized by **flaw type**, not by any specific hypothesis — so it generalizes across submissions. Diagnose first (a hypothesis often has several flaws), correct each branch, then continue into flag / variations / metrics / guardrails and finish with a configuration summary.

Target shape after correction:
> **If [single specific change], then [primary metric] will [direction] by [≥ MDE], because [causal mechanism grounded in observed data] — while [guardrail metric] does not regress.**

---

## Stage A — Diagnose the flaw(s)

Run every check; record all that fire. Then apply the matching correction move.

| # | Flaw | Symptom / tells | Correction move |
|---|------|-----------------|-----------------|
| F1 | **Vague or absent intervention** | "Better engagement", "Increase revenue", "improve onboarding" — names a goal, not a change | Elicit the *specific* change. Force a concrete control vs. treatment ("button copy 'Buy Now' vs. 'Get Started'", not "new button"). |
| F2 | **No measurable success metric** | "improve performance", "better experience", outcome is an adjective | Operationalize the outcome into ONE primary metric with a direction (latency ms, conversion rate, trades/user). |
| F3 | **Missing causal mechanism** | change→outcome stated, no "because"; can't say *why* it would work | Add the mechanism. If no plausible mechanism exists, question whether it's worth testing. |
| F4 | **Not falsifiable / untestable** | "will do better or as well", "should have no negative impact", "figure out which resonates", tautology | Commit to a directional, disconfirmable prediction with a threshold. Reframe exploratory "which is better?" as an A/B with an explicit decision rule. |
| F5 | **Conflates multiple variables** | bundles changes ("colors + typography + hero", "redesign + new CTA + new copy") | Isolate to one variable. If the bundle must ship together, label it explicitly as a "does the package work" test and note attribution is lost + plan follow-up isolations. |
| F6 | **Not grounded in usage data** | asserts a problem/opportunity with no evidence it exists | Tie to the observed signal that prompted it ("27% drop off at step X"). If there's no data, mark assumption-driven, lower priority, or measure a baseline first. |
| F7 | **Metric ↔ outcome mismatch** | predicts one thing (engagement) but proposes measuring another (revenue) | Align the primary metric to the *predicted* outcome; demote the rest to secondary/guardrail. |
| F8 | **Directionally ambiguous / multi-outcome** | "will differ", "will impact volume", no clear up/down | Commit to an expected direction (or explicitly frame as a two-sided / guardrail test). |

---

## Stage B — Rebuild the hypothesis

1. Take the corrected pieces and write ONE sentence in the canonical form.
2. Re-check falsifiability: *"What result would prove this wrong?"* — if you can't answer, it isn't done.
3. Re-check single-variable: *"Is exactly one thing changing between control and treatment?"*
4. Re-check grounding: *"What in the data made us believe this?"*

---

## Stage C — Continue the tree to configuration

### C1 — Flag
- **What is toggled?** = the intervention from F1.
- **Name** it in kebab-case describing the toggle, not the outcome: `search-mini-charts`, `paywall-simplified`, `terms-copy-casual`.
- **Kind:** boolean if control vs. one treatment; multivariate if 3+ variants (e.g., copy A/B/C).

### C2 — Variations
- **Control** = the current experience, stated concretely (not "old").
- **Treatment(s)** = the changed experience, implementation-specific: exact copy, values, layout — enough that an engineer could build it without asking.
- One variable differs across variations (ties back to F5).

### C3 — What to measure
- **Primary metric** = the single number the hypothesis predicts will move, with direction → `successCriteria` (higher/lower is better). One primary only (ties back to F2/F7).
- **Secondary metrics** = supporting signals you expect to move but won't decide on.
- **Guardrail metrics** = things that must NOT regress (latency, error rate, refunds, unsubscribes) — the defense against a "win" that quietly hurts elsewhere.

### C4 — Best-practice checks before launch
- **Single-variable isolation** — confirmed in C2.
- **Minimum Detectable Effect (MDE) + sample size** — from the expected magnitude: smaller expected lift → larger sample / longer runtime. If the metric's baseline volume can't reach significance for the stated MDE in a reasonable window, say so and either raise the MDE, pick a higher-volume metric, or extend runtime.
- **False-positive control** — one primary metric; if watching many metrics, apply multiple-comparison correction and don't peek/stop early.
- **Guardrails defined** — at least one, per C3.

---

## Stage D — Configuration summary (always end here)

```
Hypothesis:      If we [change] for [audience], then [primary metric] will [direction]
                 by [~magnitude ≥ MDE], because [mechanism grounded in data] — while
                 [guardrail] stays flat.
Flag:            <flag-key>  (boolean | multivariate)
Variations:      Control  = <specific current experience>
                 Treatment = <specific changed experience>
Primary metric:  <metric>  (higher/lower is better)
Guardrail(s):    <metric(s) that must not regress>
Sample/runtime:  <MDE> → ~<n per arm> / ~<days> at current volume
```

---

## Worked traversals (real, lightly anonymized submissions)

### "Enabling batching will improve performance"
- **Flaws:** F2 (no metric — "performance"), F3 (no mechanism), F8 (no direction stated concretely), F6 (grounding unknown).
- **Corrected:** *If we enable request batching for all backend traffic, then p95 request latency will decrease by ~15%, because batching amortizes per-request overhead — while error rate stays flat.*
- **Config:** flag `request-batching` (boolean); Control = batching off, Treatment = batching on; primary = p95 latency (lower better); guardrail = error rate; randomization unit = **request** (not user).

### "New brand UI (colors, typography, and hero) will increase signups"
- **Flaws:** F5 (three variables bundled), F3 (mechanism thin), no magnitude.
- **Corrected (isolation path):** *If we change signup-page typography to the new brand scale, then signup conversion rate will increase by ~2%, because improved hierarchy speeds scanning — while login success rate stays flat.* → plan separate tests for color and hero.
- **Corrected (bundle path, if it must ship together):** keep all three but label "package test — attribution across the three changes is not separable," and schedule isolations later.
- **Config:** flag `signup-brand-typography` (boolean); Control = current type scale, Treatment = new brand type scale; primary = signup conversion (higher better); guardrail = login success rate.

### "Figure out which wallet value-prop copy resonates most"
- **Flaws:** F4 (exploratory, not falsifiable), F2 (no metric), F1 (variants unspecified).
- **Corrected:** *If we show wallet value-prop copy "Save automatically" (B) vs. current "Manage your wallet" (A), then wallet-activation rate will be higher for B by ≥3%, because outcome-framed copy states the benefit — decision rule: ship the higher arm only if lift ≥3% and refund rate is flat.*
- **Config:** flag `wallet-valueprop-copy` (multivariate if >2 copies); Control = "Manage your wallet", Treatment = "Save automatically"; primary = wallet activation rate (higher better); guardrail = refund rate.

### "Increase revenue"
- **Flaws:** F1 (no change), F2 (revenue is the goal, not an operational metric here), F3, F6 — essentially a goal, not a hypothesis.
- **Correction:** cannot proceed as a hypothesis. Ask: what specific change, for whom, and which revenue metric (ARPU? checkout conversion? AOV?), grounded in what data? Rebuild from F1.
