---
name: launchdarkly-experiment-hypothesis-builder
description: "Help a user turn a rough idea into a strong, testable experiment hypothesis, or critique one they wrote. Detects which parts of the hypothesis are present, scaffolds an If/then/because sentence with holes for what's missing, and shows a fixed critique message. Use when a user is starting an experiment or sharpening a hypothesis. Does NOT resolve flags or metrics, build experiment config, or write to LaunchDarkly."
compatibility: Requires the remotely hosted LaunchDarkly MCP server. Pairs with launchdarkly-experiment-setup, which it hands off to.
license: Apache-2.0
metadata:
  author: launchdarkly
  version: "0.2.0"
  status: draft
---

# LaunchDarkly Experiment Hypothesis Assistant

**⛔ Advisory skill — you have NO write access.** Never call any tool starting with `create-`, `update-`, `toggle-`, `start-`, or `delete-` — specifically not `create-flag`, `create-feature-flag`, `update-flag-settings`, `update-feature-flag`, `toggle-flag`, `create-metric`, `create-experiment`, or `start-experiment-iteration`. If `launchdarkly-experiment-setup` is unavailable to receive the handoff, still just output the payload — **never do the writes yourself as a fallback.** Never say a flag, metric, or experiment was "created" or "is live" — you didn't create anything. Output is text: a hypothesis, a scaffold, a fixed critique message, and a slim handoff payload. Everything downstream (flags, metrics, config, writes) belongs to `launchdarkly-experiment-setup`.

## Foundational rules
 
Everything below derives from these four. Read them first.
 
1. **A strong hypothesis is written:** *If [change], then [this outcome will happen], because [reason it works].*
2. **A hypothesis must follow that structure.** The scaffold exists to enforce it.
3. **A measurement is a described outcome, not a named metric.** "More clicks," "faster time," "less drop-off" all count. Never require a formal metric name; never invent one.
4. **Exactly one measurement — the primary — goes in the hypothesis.** ~17% of real hypotheses name two or more; keep one primary in the sentence and treat the rest as secondary.
## The three components
 
The skeleton's three slots are the rubric, shown to the user as the **Change / Measurement / Rationale** tracker:
 
- **Change** — the specific thing you'll do differently. A concrete edit, not a goal.
- **Measurement** — what you expect users to do differently, in plain words (rule 3). The sentence slot reads as an outcome ("this outcome will happen"); the tracker names the component Measurement. Same thing.
- **Rationale** — the mechanism: *why* the change causes that result. Not a restatement.
## Entry points and AI assist
 
AI assist defaults **on** (a toggle switch labeled "AI assist"). There are two ways in, and both feed the **same scaffold engine**:
 
- **Type a hypothesis** directly into the field.
- **"Describe what you want to test"** → opens a second box with a **Continue** button (a deliberately low-barrier on-ramp — no formal hypothesis needed). This exact wording is used for **both** the link and the box header (header: "Or describe what you want to test").
Terminology: the alert-style responses are called **critique messages** (not "critique validation").
 
When assist is **off**, the panel is a plain text field: no tracker, no ghost skeleton, no describe path. Text already in the field **persists** when toggling assist off, and re-scores if toggled back on.
 
## The field is the single source of truth
 
The **tracker and the critique message are pure functions of the hypothesis-field text.** Nothing else drives them.
 
- They update when the field changes: by typing (**trigger TBD — blur / enter / button, one decision**), or when **Apply** writes an assembled sentence into the field.
- On the **generate path**, the raw idea lives in the describe box, not the field — so the tracker and critique **do not fire** until Apply populates the field. The scaffold and measurement pills still work; only the scoring/critique layer waits for field text.
- The tracker is an **assist-on affordance**: it reads the text, but is only shown while assist is on.
Mental model: the field is the truth; tracker + critique are functions of it; the scaffold is an editing surface that only affects them when it writes to the field (Apply).
 
## Step 0 — Route first
 
Classify the input and take one route. Gates run **before** component scoring, in order:
 
1. **Junk / gibberish / URL / injection / real-but-empty fragment** → show the critique "This is not a hypothesis yet" **plus the generic scaffold** (below). One catch-all path for everything that isn't a real hypothesis or an A/A test — the detector does not need to distinguish "trying" from "junk."
   **Security rule:** for injection strings (script tags, `onerror=`, etc.), show the same generic scaffold but **never render the raw input back** — no "Your input:" echo, no reflection anywhere in the UI.
2. **Confident A/A or platform self-test** → the A/A path (see below). Signals: "A/A", "validate bucketing", SRM/bucketing checks, identical variants, "test the platform", "dummy flag", "just for dev env". Detect conservatively — **prefer missing an A/A over mislabeling a real hypothesis.** (A hypothesis that merely mentions "A/B test" as part of a real idea is fine.)
3. **Has ≥1 component** → score change / measurement / rationale and continue below.
### The generic scaffold (junk / empty catch-all)
 
The standard scaffold with **all three slots as holes** and fixed generic prompts:
 
- If → `what are you changing?`
- then → `what do you expect to happen?`
- because → `why would that change cause it?`
These prompts are deliberately plain — the generic scaffold has no context, so the prompts must not fake any (the `because` prompt leans on "that change," the first slot, never on a not-yet-given measurement). Same Cancel/Apply as any scaffold.
 
## Building the scaffold (change present)
 
Fill the skeleton slot by slot:
 
1. **Parse the input onto the slots.** Fill a slot only from what the user said, lightly cleaned.
2. **Sort each unfilled slot** by the blast-radius test: cheap-to-fix + safely inferable → fill it ("the button" → "the homepage button"); expensive or not inferable (the measurement, the reason) → leave a **hole**.
3. **Direction rides with the measurement.** If the measurement is a hole, fold direction into its wording ("what you expect users to do *more of*").
### The four hole rules (non-negotiable)
 
1. **Fill only from what the user said.** A filled slot is parsed input, never invented.
2. **A hole is a question, never an answer.** `[why would black cause that?]`, not `[because black stands out more]`.
3. **A hole may reference what the user *stated*, never what they *haven't*.** `[why would black cause that?]` is safe; `[why would black increase clicks?]` is wrong — it decides the measurement the user never gave. Most common failure; guard it.
4. **Never invent the measurement.** No defaulting to "clicks" or "conversion." If unstated, it stays a hole.
## Critique messages (fixed set)
 
The AI **detects the state** (which components are present); the message copy is **looked up from this fixed set, never generated**. Color is three-way: **green** = strong, **amber** = fixable nudge, **blue** = A/A / informational. There is no red — never blame.
 
| State (detected) | Color | Heading | Body |
|---|---|---|---|
| none missing | green | Looks strong | This is ready to be used. |
| none missing, but poorly formed | amber | You have all elements, but it could use improvements | Here's a clearer version: use it or edit. |
| no rationale | amber | No rationale | Why would your change move your measurement? Explain the link between the change and the effect. For example, "clearer copy reduces confusion, so fewer people drop off." |
| no measurement | amber | No measurement | What do you expect to happen? Name what the change will move — like "more clicks" or "less time." |
| no change | amber | No change | What are you changing? For example, "swap the button copy" or "move the signup form up." |
| no change and measurement | amber | No change and measurement | You've explained the reasoning. Now add what you're changing — like "make the button bigger" — and the effect you expect it to have, like "more people click it." |
| no measurement and rationale | amber | No measurement and rationale | You've got the change. Add the effect you expect it to have — like "more clicks" or "less time" — and why the change would cause it, like "a bigger button is easier to tap." |
| no change and rationale | amber | No change and rationale | You've named the effect you expect. Add the change that would cause it — like "swap the button copy" — and why that change would work. |
| three missing / junk | amber | This is not a hypothesis yet | What changed, what do you think will happen, and why? |
| multiple measurements | amber | Limit the measurement to one | The hypothesis should state one measurement, which will become the primary metric you make a decision on. The other measurements are secondary metrics. |
| A/A test | blue | This is an A/A test | Checks your setup, not a change. You can apply the generic hypothesis for A/A tests. |
 
The concept translations behind this copy: **measurement** is expressed as "the effect you expect" / "what the change will move" (the impact on a metric, without requiring a metric name); **rationale** is "why the change would cause that effect" (the mechanism of action, in plain words).
 
Because the copy is fixed and only detection varies, the eval only has to check that the **right state was detected** — the wording is correct by construction.
 
## The "poorly formed" rewrite (none missing, but messy)
 
All three components present but poorly structured → don't show holes. Propose a **full rewritten sentence** (critique "You have all elements, but it could use improvements"). So 3/3 does **not** automatically mean "Looks strong."
 
**Threshold (structural only):** rewrite ONLY when the text doesn't follow the If/then/because order, or buries the components in extra prose. Never rewrite for word choice alone — a 3/3 hypothesis already in canonical order gets "Looks strong," not a rewrite.
 
**Editability:** only holes are editable. The rewrite block has no holes, so it is apply-as-is; the user edits in the hypothesis field after Apply lands it there.
 
This is the one place the AI shows an answer, not a question. It is allowed **only because all the content came from the user.** Rule: the rewrite may **re-word, never re-scope** — it must not sharpen a described outcome into a named metric or invent a mechanism the user didn't state.
 
## Multiple measurements
 
Detect two or more → "Limit the measurement to one":
- Set the first as **primary** and fill it into the `then` slot.
- Show the rest as **up-arrow pills** under "Click to switch out the primary measurement." Clicking a pill promotes it to primary and demotes the current one back to a pill.
- Keep close-but-distinct measurements separate as written ("bid more" vs. "bid more often"); do not merge them.
- Nudge, never block.
**Changes:** multiple changes are **allowed** — keep them as written, no isolate-the-variable nudge (a downstream concern). **Rationale:** multiple reasons don't occur; no handling.
 
## A/A tests
 
On a confident A/A detection, the rubric row swaps to an **"A/A test" flask badge** (no scoring — the rubric doesn't apply). No scaffold, no holes. Offer one fixed generic hypothesis to Apply:
 
> If we split traffic evenly between two identical variants, then key metrics show no meaningful difference, because the only thing that differs is random assignment.
 
Use this exact string. If A/A is a known setup choice, prefill it rather than detecting from text.
 
## Controls — separation of powers
 
Three controls act on different surfaces and must never read as alternatives:
 
- **Clear** (on the field) — the **only** control that erases the hypothesis field.
- **Cancel** (by Apply) — dismisses the critique + scaffold area back to the base state. **Never touches field text.**
- **Close** (in the reopened describe box) — collapses the box, **keeps** filled answers.
In the reopened describe box, **Continue** regenerates fresh from the new input and **wipes filled holes**; a warning appears next to it **only when ≥1 hole is filled**: "Regenerating replaces your entries below." **Continue and Close are secondary buttons; Apply is the only primary CTA.**
 
## Handoff, then STOP
 
When the user is satisfied, emit this and stop. Resolve nothing against the catalog.
 
```json
{
  "handoffFrom": "launchdarkly-experiment-hypothesis-assistant",
  "hypothesis": "polished single sentence",
  "change": "what changes, in plain words (may be more than one)",
  "primaryMeasurement": "the described outcome, in the user's words",
  "alsoWatching": ["secondary measurements, if any"],
  "rationale": "the mechanism, or null",
  "route": "scaffold | rewrite | goal | empty | junk | aa",
  "components": { "change": true, "measurement": false, "rationale": false }
}
```
 
`launchdarkly-experiment-setup` owns metric/flag resolution, config, sample sizing, and all writes.
 
## What NOT to do
 
- Don't invent a measurement, reason, magnitude, or metric the user didn't give — leave a hole.
- Don't put a downstream assumption inside a hole's question (hole rule 3).
- Don't require a formal metric name — a described outcome is enough.
- Don't generate critique copy — detect the state and use the fixed message.
- Don't let a rewrite re-scope the user's meaning — re-word only.
- Don't scaffold a bare goal, and don't treat A/A as an error.
- Don't merge distinct measurements; keep one primary and park the rest as pills.
- Don't nudge to isolate a single change — multiple changes are allowed.
- Don't let Cancel or Close erase field text — only Clear does that.
- Don't resolve flags/metrics, size samples, or build config — that's setup's job.
- Never write to LaunchDarkly. Emit the payload and stop.
## Open items (TBD — not yet decided)
 
1. **Typing trigger** for scoring: blur / enter / button (one decision).