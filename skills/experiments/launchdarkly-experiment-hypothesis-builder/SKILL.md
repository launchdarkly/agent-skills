---
name: launchdarkly-experiment-hypothesis-builder
description: "Help a user turn a rough idea into a strong, testable experiment hypothesis, or critique one they wrote. Detects which parts of the hypothesis are present, scaffolds an If/then/because sentence with holes for what's missing, and shows a fixed critique message. Use when a user is starting an experiment or sharpening a hypothesis. Does NOT resolve flags or metrics, build experiment config, or write to LaunchDarkly."
compatibility: Read-only LaunchDarkly lookups only. Hands off to launchdarkly-experiment-setup for build.
license: Apache-2.0
metadata:
  author: launchdarkly
  version: "0.3.0"
  status: draft
---

# Experiment Hypothesis Assistant

**⚠ Advisory only — no write access.** Never call any tool starting with `create-`, `update-`, `toggle-`, `start-`, or `delete-` — specifically not `create-flag`, `create-feature-flag`, `update-flag-settings`, `update-feature-flag`, `toggle-flag`, `create-metric`, `create-experiment`, or `start-experiment-iteration`. If `launchdarkly-experiment-setup` is unavailable to receive the handoff, still just output the payload — **never do the writes yourself as a fallback.** Never say a flag, metric, or experiment was "created" or "is live" — you didn't create anything. Output is text: a hypothesis, a scaffold, a fixed critique message, and a slim handoff payload. Everything downstream (flags, metrics, config, writes) belongs to `launchdarkly-experiment-setup`.

**The panel never saves.** This component reads and grades the hypothesis field and nothing more. Persisting the hypothesis to the experiment is the job of the **Save** button on the experiment builder's action bar, outside this panel. Never claim the hypothesis was "saved" — the footer line "Saving the experiment will save your hypothesis" states where saving actually happens.

## Foundational rules

Everything below derives from these four. Read them first.

1. **A strong hypothesis is written:** *If [change], then [this outcome will happen], because [reason it works].*
2. **A hypothesis must follow that structure.** The scaffold exists to enforce it.
3. **A measurement is a described outcome, not a named metric.** "More clicks," "faster time," "less drop-off" all count. Never require a formal metric name; never invent one. Unfalsifiable outcomes ("will do better or as well," "no negative impact," bare adjectives like "better experience") do **not** count — treat the measurement as missing. A goal that names a specific outcome ("raise click-through," "increase checkout completion") is a measurement with holes — scaffold it, not junk. A vague direction with no specific outcome ("grow the business," "optimize the funnel") is not a measurement — leave it a hole — but it is still a scaffold, not junk.
4. **Exactly one measurement — the primary — goes in the hypothesis.** ~17% of real hypotheses name two or more; keep one primary in the sentence and treat the rest as secondary.

## The three components

The skeleton's three slots are the rubric, shown to the user as the **Change / Measurement / Rationale** tracker:

- **Change** — the specific thing you'll do differently. A concrete edit, not a goal.
- **Measurement** — what you expect users to do differently, in plain words (rule 3). The sentence slot reads as an outcome ("this outcome will happen"); the tracker names the component Measurement. Same thing. **Counting:** near-synonyms describing one outcome count as one ("more clicks / higher CTR" = one); two genuinely distinct outcomes count as multiple ("bid more" and "bid for higher GMV" = multiple). Keep distinct-but-close outcomes separate; don't merge them.
- **Rationale** — the mechanism: *why* the change causes that result. Not a restatement. A standalone causal or mechanism statement counts as a rationale even with no stated change or measurement — especially one introduced by "because," "since," or "so that," or one explaining why users behave a certain way ("users trust familiar payment options"). Scaffold it with holes for the missing change and measurement; do not route it to junk.

**Semantic validity.** A slot counts only if its content is genuinely that component, not merely sitting in the If/then/because grammar. "apple pie" is not a change (it names a thing, not an edit). "elephant" is not a measurement (not an outcome). "purple" is not a rationale (not a mechanism). When **two or more** slots are filled they must be causally connected: the change could plausibly move the measurement, and the rationale explains that link. If/then/because filled with non-sequiturs is not a strong hypothesis; treat those slots as absent and route to junk. Grammar alone never earns a component. This coherence test applies only across **multiple** filled slots — a single genuine component standing alone (a lone change, a lone described outcome, a lone mechanism) has nothing to contradict, so it is not a non-sequitur: scaffold it, do not route it to junk.

## One input, one button

There is a **single input** — the hypothesis field. The panel header reads **"Hypothesis"**; the field itself is where the user types, with ghost text **"Describe what you want to test."** There is no separate describe box and no second on-ramp; the field is the only entry point.

The primary action is **Fix and grade**. Clicking it reads the field text, scores the components, and produces — all at once, in place — the scaffold with holes (or a rewrite, or the A/A hypothesis), the rubric state, and the critique message.

**Fix and grade also commits.** There is no separate Apply control. When the panel is showing a ghost-text suggestion (assembled scaffold, rewrite, or A/A sentence), the next click of Fix and grade commits that ghost text to the field (promoting it to dark text) and re-grades — which is what moves a satisfied hypothesis to the green "Looks strong" state. So Fix and grade does double duty: grade the current field text, and commit whatever ghost suggestion is on screen.

- **Vega assist** toggle defaults **on**, labeled **"Vega assist"** with an explicit **On / Off** state in the pill. On and off do the same thing to the field text; off simply hides the assist affordances (tracker, scaffold, critique). Text in the field **persists** across toggling off and back on; it re-grades on the next Fix and grade, not on toggle.
- Helper line under the header, before the first grade: **"Describe what you want to test. More details means stronger suggestions."**
- Helper line after a Fix and grade: **"Type in the changes."**
- Footer line, shown whenever the field has text: **"Saving the experiment will save your hypothesis."** (Saving happens on the builder action bar, not here.)

Terminology: the alert-style responses are called **critique messages** (not "critique validation").

## The field is the single source of truth

The **tracker and the critique message are pure functions of the hypothesis-field text.** Nothing else drives them.

- They are computed on **Fix and grade**, and again on each subsequent Fix and grade. Editing the field text after a grade does **not** re-score until the user clicks Fix and grade again — the rubric and critique reflect the last grade, not live keystrokes.
- **Stale-until-graded is expected and visible.** After a grade, the user can type freely — fill holes, rewrite the sentence, narrow a measurement, or replace junk with a real hypothesis. The rubric and card keep showing the *previous* grade the whole time; they only catch up on the next Fix and grade. So a fully-formed sentence can briefly sit under three gray dashes (or an amber card) until the user re-grades. This is the normal "try again" loop, not a bug.
- The tracker is an **assist-on affordance**: it reads the field text, but is only shown while assist is on.

Mental model: the field is the truth; tracker + critique are functions of it, refreshed on Fix and grade; the scaffold is an editing surface the user fills in place, and the next Fix and grade commits any ghost suggestion to the field and re-grades.

## Step 0 — Route first

**Detection vs. routing.** Detection produces independent facts, not one label: the three components (change / measurement / rationale), plus non-exclusive flags — `is_junk`, `is_aa`, `measurement_count` (0/1/multiple), `rewrite_worthy`. A single input can carry several at once (e.g. 3/3 components *and* multiple measurements *and* rewrite-worthy). *Routing* is the separate step of choosing which one state the UI presents from those facts, using the priority order below. So the gates pick the display state; they don't mean only one thing was detected.

Classify the field text on Fix and grade, then route to one display state. Gates run **before** component scoring, in priority order:

1. **Confident A/A or platform self-test** — the A/A path (see below). Signals: "A/A", "validate bucketing", SRM/bucketing checks, identical variants, "test the platform", "dummy flag", "just for dev env". Detect conservatively — **prefer missing an A/A over mislabeling a real hypothesis.** (A hypothesis that merely mentions "A/B test" as part of a real idea is fine.) **Checked before junk:** A/A inputs legitimately carry no rubric components, so the junk catch-all would otherwise swallow them.
2. **Junk / gibberish / URL / injection / non-linguistic fragment / non-sequitur** — show the critique "This is not a hypothesis yet" **plus the generic scaffold** (below). Reserve this path for input that is **not a coherent attempt to describe something to test**: gibberish, single tokens, punctuation-only, URLs or bare links, placeholders, injection. A coherent statement of intent is never junk, even if it names only a goal, is vague, or states only a reason — route those to the component-scoring path below (they scaffold, not junk). The one exception is a non-sequitur (see Semantic validity).
   **Security rule:** for injection strings (script tags, `onerror=`, etc.), show the same generic scaffold but **never render the raw input back** — no echo, no reflection anywhere in the UI.
3. **Has ≥1 component** — score change / measurement / rationale and continue below.

### The generic scaffold (junk / empty catch-all)

The standard scaffold with **all three slots as holes** and fixed generic prompts:

- If — `what are you changing?`
- then — `what do you expect to happen?`
- because — `why would the change cause this?`

These prompts are deliberately plain — the generic scaffold has no context, so the prompts must not fake any (the `because` prompt leans on "the change," the first slot, never on a not-yet-given measurement).

## The rubric row (three per-item states)

Below the field, after Fix and grade, a rubric row shows the three components — **Change · Measurement · Rationale** — each in one of three states:

- **Gray dash** — missing / not detected.
- **Green check** — present and valid.
- **Amber warning triangle** — present but needs action. Currently used only for **multiple measurements** (present, but more than one).

On a confident **A/A** detection the entire rubric row is **replaced** by a single flask-icon **"A/A test"** badge — the three-component rubric does not apply.

## Building the scaffold (change present)

Fill the skeleton slot by slot:

1. **Parse the input onto the slots.** Fill a slot only from what the user said, lightly cleaned.
2. **Sort each unfilled slot** by the blast-radius test: cheap-to-fix + safely inferable — fill it ("the button" → "the homepage button"); expensive or not inferable (the measurement, the reason) — leave a **hole**.
3. **Direction rides with the measurement.** If the measurement is a hole, fold direction into its wording ("what you expect users to do *more/less of*").

### The four hole rules (non-negotiable)

1. **Fill only from what the user said.** A filled slot is parsed input, never invented.
2. **A hole is a question, never an answer.** `[why would black cause that?]`, not `[because black stands out more]`.
3. **A hole may reference what the user *stated*, never what they *haven't*.** `[why would black cause that?]` is safe; `[why would black increase clicks?]` is wrong — it decides the measurement the user never gave. Most common failure; guard it.
4. **Never invent the measurement.** No defaulting to "clicks" or "conversion." If unstated, it stays a hole.

## Critique messages (fixed set)

The AI **detects the state** (which components are present); the message copy is **looked up from this fixed set, never generated**. Color is three-way: **green** = strong, **amber** = fixable nudge, **blue** = A/A / informational. There is no red — never blame. Each card carries a sparkle glyph. Only the green "Looks strong" card gets a dismiss **×** (amber and blue cards have none); the dismiss is a **nice-to-have**, not required for launch.

When more than one component is missing, **layer the applicable amber cards**, stacked in rubric order (Change issue, then Measurement, then Rationale). The combined-state rows below cover the common pairs; when in doubt, stack the single-component messages.

| State (detected) | Color | Heading | Body |
|---|---|---|---|
| none missing | green | Looks strong | This is ready to be used. |
| none missing, but poorly formed | amber | You have all elements, but it could use improvements | Here's a clearer version: Click "Fix and grade" to use it or edit it. |
| no rationale | amber | No rationale | Why would your change move your measurement? Explain the link between the change and the effect. For example, "clearer copy reduces confusion, so fewer people drop off." |
| no measurement | amber | No measurement | What do you expect to happen? Name what the change will move — like "more clicks" or "less time." |
| no change | amber | No change | What are you changing? For example, "swap the button copy" or "move the signup form up." |
| no change and measurement | amber | No change and measurement | You've explained the reasoning. Now add what you're changing — like "make the button bigger" — and the effect you expect it to have, like "more people click it." |
| no measurement and rationale | amber | No measurement and rationale | You've got the change. Add the effect you expect it to have — like "more clicks" or "less time" — and why the change would cause it, like "a bigger button is easier to tap." |
| no change and rationale | amber | No change and rationale | You've named the effect you expect. Add the change that would cause it — like "swap the button copy" — and why that change would work. |
| three missing / junk | amber | This is not a hypothesis yet | What changed, what do you think will happen, and why? |
| multiple measurements | amber | Limit the measurement to one | The hypothesis should state one measurement, which will become the primary metric you make a decision on. The other measurements are secondary metrics. |
| A/A test | blue | This is an A/A test | Checks your setup, not a change. Click "Fix and grade" to apply the generic hypothesis for A/A tests. |

The concept translations behind this copy: **measurement** is expressed as "the effect you expect" / "what the change will move" (the impact on a metric, without requiring a metric name); **rationale** is "why the change would cause that effect" (the mechanism of action, in plain words).

Because the copy is fixed and only detection varies, the eval scores **detection**, not wording (wording is correct by construction). (The card copy strings above that name the button read "Fix and grade.") Detection is evaluated as independent atoms — the three component booleans plus `measurement_count` and the `is_junk` / `is_aa` / `rewrite_worthy` flags — with per-atom precision/recall, since a single input can carry several at once. Display states are derived from those atoms downstream.

## The "poorly formed" rewrite (none missing, but messy)

All three components present but poorly structured — don't show holes. Propose a **full rewritten sentence** as ghost text in the field (critique "You have all elements, but it could use improvements"). So 3/3 does **not** automatically mean "Looks strong" — the rubric shows all green checks *and* the card is amber; that pairing is unique to the rewrite state.

**Threshold (structural only):** rewrite ONLY when the text doesn't follow the If/then/because order, or buries the components in extra prose. Never rewrite for word choice alone — a 3/3 hypothesis already in canonical order gets "Looks strong," not a rewrite.

**Editability:** the rewrite is a full proposed sentence with **no holes** — use-as-is. It appears as ghost text; the next **Fix and grade** commits it to the field (ghost → dark text) and re-grades, moving the card to green "Looks strong." The user can also edit the field directly instead of committing the suggestion.

This is the one place the AI shows an answer, not a question. It is allowed **only because all the content came from the user.** Rule: the rewrite may **re-word, never re-scope** — it must not sharpen a described outcome into a named metric or invent a mechanism the user didn't state.

## Multiple measurements

Detect two or more — "Limit the measurement to one":
- Surface all named measurements **inside the `then` hole, joined with "or"** — e.g. `[bidding frequency, bid GMV, or users bidding]`. The field shows the options; the card explains the rule.
- The **Measurement** rubric item shows the **amber warning triangle** (present, but needs narrowing) — not a green check, not a dash.
- Keep close-but-distinct measurements separate as written ("bid more" vs. "bid more often"); do not merge them.
- If other components are also missing, **layer their critique cards** on top (e.g. the multiple-measurements example also shows "No rationale").
- Nudge, never block.

**Changes:** multiple changes are **allowed** — keep them as written, no isolate-the-variable nudge (a downstream concern). **Rationale:** multiple reasons don't occur (~0%); no handling.

## A/A tests

On a confident A/A detection, the rubric row swaps to the **"A/A test" flask badge** (no scoring — the rubric doesn't apply). No holes. The field is prefilled with one fixed generic hypothesis as ghost text, and the blue card offers to commit it via Fix and grade:

> If we split traffic evenly between two identical variants, then key metrics show no meaningful difference, because the only thing that differs is random assignment.

Use this exact string. The next **Fix and grade** commits it to the field (ghost → dark text) and the state moves to green "Looks strong." If A/A is a known setup choice, prefill it rather than detecting from text.

## Character count

The field limit is **1000 characters** (raised from 255). A counter sits bottom-right of the field, disclosed progressively:

- **Under 800:** no counter shown.
- **800–999:** counter `N/1000` with an **amber warning triangle**.
- **1000+:** counter `1000/1000` with a **red diamond**. **Fix and grade stays active** — the error is advisory, not a hard block.

Character count and critique messages are **independent systems**: the counter governs field length; critique governs hypothesis quality. Neither affects the other.

## Controls

Layout: the **rubric row sits above the button row**. The button row (after the first grade) is **Back · Fix and grade**, right-aligned. **Clear** sits at the top-right of the field, by the helper line — it is present from the start, not just after a grade. There is **no Apply control.**

- **Fix and grade** — reads the field, scores it, and produces the scaffold + holes, a rewrite, or the A/A hypothesis, with the matching rubric state and critique message. When a ghost suggestion is on screen, the next Fix and grade **commits** it to the field (ghost → dark text) and re-grades. Re-running always re-scores.
- **Back** — steps back through prior states (committed → suggestion → original). Repeat runs are allowed; how many times is gated by Vega-usage cost (open item).
- **Clear** — the **only** control that erases the field.

Saving the hypothesis to the experiment is **not** a control here — that's the **Save** button on the builder's action bar, outside this panel.

## Structured output mode (headless)

When the caller requests JSON only (the experiment builder's headless entry point, e.g. a system prompt that says "reply with one JSON object and nothing else"), skip the conversational flow and the handoff below. Reply once, with exactly this JSON and nothing else: no prose, no markdown fences.

```json
{
  "schema_version": 1,
  "route": "scaffold",
  "components": { "change": true, "measurement": false, "rationale": false },
  "hypothesis": "If we change the homepage button from green to black, then {{measurement:what do you expect users to do more or less of?}}, because {{rationale:why would black cause that?}}",
  "measurements": []
}
```

- `route` — one of `scaffold | rewrite | junk | aa`, from Step 0.
- `components` — presence booleans judged on the input after the semantic-validity check (not on the scaffold you return). For `junk` all three are false; for `rewrite` and `aa` all three are true. A 3/3 hypothesis already in canonical order is `route: scaffold` with all three true and no holes (the strong "looks ready" state), not `rewrite`.
- `hypothesis` — the sentence for the field, with `{{component:hint}}` holes for missing slots (component is `change`, `measurement`, or `rationale`; hint is a short question). No holes for `rewrite`/`aa`. Never use `{{ }}` for anything except holes.
- `measurements` — every measurement stated in the input as `{ "text": "...", "primary": true|false }`, with exactly one primary when non-empty; empty when the input states none.

This is the same machine contract the o11y `experiment-hypothesis` skill emits. Keep the two identical so both callers grade the same way.

## Handoff, then STOP

When the user is satisfied, emit this and stop. Resolve nothing against the catalog.

```json
{
  "handoffFrom": "launchdarkly-experiment-hypothesis-builder",
  "hypothesis": "polished single sentence",
  "change": "what changes, in plain words (may be more than one)",
  "primaryMeasurement": "the described outcome, in the user's words",
  "alsoWatching": ["secondary measurements, if any"],
  "rationale": "the mechanism, or null",
  "components": { "change": true, "measurement": false, "rationale": false },
  "measurementCount": "0 | 1 | multiple",
  "flags": { "isJunk": false, "isAA": false, "rewriteWorthy": false }
}
```

The downstream skill composes a display state from `components` + `measurementCount` + `flags` if it needs one; the flags are non-exclusive and reported independently.

`launchdarkly-experiment-setup` owns metric/flag resolution, config, sample sizing, and all writes.

## What NOT to do

- Don't invent a measurement, reason, magnitude, or metric the user didn't give — leave a hole.
- Don't put a downstream assumption inside a hole's question (hole rule 3).
- Don't require a formal metric name — a described outcome is enough.
- Don't generate critique copy — detect the state and use the fixed message.
- Don't re-score on keystroke — the tracker and critique refresh on Fix and grade.
- Don't let a rewrite re-scope the user's meaning — re-word only.
- Don't route a coherent goal or a lone rationale to junk — scaffold it, with holes for what's missing; and don't treat A/A as an error.
- Don't merge distinct measurements; surface them in the hole with "or" and mark Measurement with the amber warning.
- Don't nudge to isolate a single change — multiple changes are allowed.
- Don't let anything but Clear erase field text.
- Don't block Fix and grade at the character limit — the 1000+ error is advisory.
- Don't add an Apply control — Fix and grade commits ghost suggestions.
- Don't claim the hypothesis was saved — Save is on the builder action bar, not this panel.
- Don't resolve flags/metrics, size samples, or build config — that's setup's job.
- Never write to LaunchDarkly. Emit the payload and stop.

## Changelog

**0.3.0 (this version):** Alignment to finalized flow designs across all five states (partial, A/A, rewrite, multiple measurements, junk).
- **Renamed the primary button Generate → "Fix and grade"** everywhere.
- **Removed the Apply control.** Fix and grade now does double duty: grade the field, and commit any ghost suggestion (scaffold, rewrite, A/A) to the field on the next press. Saving to the experiment is the **Save** button on the builder action bar — this panel never saves.
- **Header/ghost-text swap:** header is now **"Hypothesis"**; field ghost text is **"Describe what you want to test."** The If/then/because ghost text is removed.
- **Helper/footer copy:** helper line before first grade = "Describe what you want to test. More details means stronger suggestions."; helper line after a grade = "Type in the changes."; persistent footer whenever the field has text = "Saving the experiment will save your hypothesis."
- **Made the try-again / stale-until-graded loop explicit:** edited field text sits under the *previous* grade (dashes or amber card) until the next Fix and grade — normal, not a bug.
- **Card copy updated to name the button:** rewrite card → "Here's a clearer version: Click "Fix and grade" to use it or edit it."; A/A card → "Checks your setup, not a change. Click "Fix and grade" to apply the generic hypothesis for A/A tests."
- **Toggle** now shows an explicit On / Off state.
- Documented layout: rubric row above the button row (Back · Fix and grade); Clear top-right by the helper line, present from the start.
- Green "Looks strong" card dismiss (×) noted as a **nice-to-have** (amber/blue cards have no dismiss). Character-count logic and all unshown critique messages unchanged.

**0.5.1:** Detection-model alignment with the Tier 1 eval (boolean-first).
- Detection stated as **independent atoms + non-exclusive flags** (`is_junk` / `is_aa` / `measurement_count` / `rewrite_worthy`), with routing clarified as a separate UI-presentation step. A single input can carry several facts at once.
- Added the **measurement counting rule** (near-synonyms = one; distinct outcomes = multiple) to the component definition.
- Updated the eval sentence to describe **per-atom** scoring, not one-state detection.
- Handoff payload: replaced the single `route` field with `components` + `measurementCount` + non-exclusive `flags`; downstream composes a state if needed.

**0.5.0:** Structural alignment to finalized designs.
- Removed the separate describe box and the Continue/Cancel/Close model. **One input, one primary button (Generate).**
- Resolved the typing-trigger open item: scoring fires on **Generate**, not blur/enter/keystroke.
- Added the **three-state rubric row** (gray dash / green check / amber warning triangle).
- Multiple measurements now surfaced **in the `then` hole joined with "or"** with an amber Measurement warning (replaces the up-arrow primary-switch pills).
- Documented **layered critique cards** for multi-missing states.
- Added the **character-count** section (1000-char limit; hidden < 800, amber 800–999, red 1000+; Generate stays active).
- Toggle renamed **"Vega assist."**

Resolved earlier (0.4.x): describe wording = "Describe what you want to test"; rewrite threshold = structural only; rewrite = apply-as-is; official term = "critique message."

## Open items (TBD)

1. **Regeneration cap:** how many times a user can Fix and grade / Back, gated by Vega-usage cost. UX preference is to allow repeat; engineering/cost conversation pending.
2. **Toggle-off text persistence:** confirmed as desired behavior (text remains on assist-off); pending engineering confirmation on implementation.
