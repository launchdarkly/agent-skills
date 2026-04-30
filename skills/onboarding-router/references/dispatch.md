# Dispatch table

Maps each route to its destination — the skill, docs, or MCP server the user should land on. Used by the parent [SKILL.md](../SKILL.md) Step 4 (handoff).

The handoff message has three parts:

1. **The route** — which surface you picked, in plain English.
2. **The next action** — the skill / link / command the user (or you) should invoke next.
3. **The "why"** — one sentence so the user can sanity-check your routing.

Don't include the rationale rulebook. Don't paste the destination skill's workflow. Keep it short.

---

## `flags` → existing onboarding skill

**Destination:** [`onboarding`](../../onboarding/SKILL.md) — the existing LaunchDarkly SDK onboarding skill (kickoff roadmap, log, MCP, SDK install detect/plan/apply, first flag).

**How to invoke:**

- Claude Code / Cursor with the LaunchDarkly plugin: tell the user to run `/onboarding`, or invoke that skill directly if your runtime supports it.
- Otherwise: `npx skills add launchdarkly/ai-tooling --skill onboarding -y --agent <agent-id>` and then re-prompt.

**Sample handoff line:**

> "Going to start you on **Feature Flags** — that's the foundation, and your repo's a good fit. Handing off to the LaunchDarkly onboarding skill now: it'll set up the MCP server, install the right SDK, and walk you through your first flag."

**What the destination expects from you:**

- A clean handoff. The onboarding skill runs its own kickoff roadmap and log; don't try to set those up yourself first.
- Optional: pass along anything you noticed in Step 2 (language, framework, monorepo target). The onboarding skill will rediscover it but a head start helps.

---

## `ai-configs` → AI Config creation skill

**Destination:** [`aiconfig-create`](../../ai-configs/aiconfig-create/SKILL.md).

**How to invoke:**

- `/aiconfig-create` (Claude Code / Cursor with the plugin).
- Otherwise: `npx skills add launchdarkly/ai-tooling --skill aiconfig-create -y --agent <agent-id>` and re-prompt.

**Critical follow-up to mention.** AI Configs are not servable on creation — they default to a disabled fallthrough variation. Tell the user that after `aiconfig-create` they'll need to run `aiconfig-targeting` (or its REST/CLI equivalent) before the SDK will return their variation. This is the most common AI-Configs failure mode and the destination skill itself flags it, but it's worth surfacing in your handoff.

**MCP prerequisite.** `aiconfig-create` requires the LaunchDarkly hosted MCP server. If the user hasn't configured it yet, point them at [`mcp-configure`](../../onboarding/mcp-configure/SKILL.md) first or tell them the destination skill will surface the error itself.

**Sample handoff line:**

> "Going to start you on **AI Configs** — your repo is full of `openai` calls and that's where you'll get the most value first. Handing off to the AI Config creation skill. After it creates your config, you'll also need to run **aiconfig-targeting** to make it servable — the create skill on its own leaves the config in a disabled state by default."

**What the destination expects from you:**

- The user's intent (e.g. "support chatbot", "summarization feature") so it can pick the right mode.
- A note on which provider they're using if the codebase made it obvious — saves the destination from re-asking.

---

## `experiments` → composed multi-skill path

**Destination:** No single experiments-onboarding skill exists yet. Compose:

| Step | Skill                             | Purpose                                                  |
| ---- | --------------------------------- | -------------------------------------------------------- |
| 1    | `launchdarkly-flag-create` *or* `aiconfig-create` | Create the thing being experimented on (flag or AI Config variation). |
| 2    | `launchdarkly-metric-choose`      | Pick primary + guardrail metrics. Surfaces release-policy auto-attaches. |
| 3    | `launchdarkly-metric-create`      | Create the metric and instrument the event.              |
| 4    | `launchdarkly-metric-instrument`  | Add `track()` calls to existing code if the metric exists but the event isn't fired. |
| 5    | LaunchDarkly experiments docs     | Actually start the experiment in the dashboard. Link: https://launchdarkly.com/docs/home/experimentation |

**How to invoke:**

- Tell the user this is a multi-step path and that you'll start with Step 1.
- Confirm which artifact they're experimenting on (a feature flag or an AI Config). If they don't know, they probably want `flags` first — route there.
- Then invoke `launchdarkly-flag-create` or `aiconfig-create` as the first step. Hand back to the user / next agent for the metric skills.

**Sample handoff line:**

> "Going to start you on **Experiments** — but heads up: experiments here are a 4-step path because they sit on top of flags + metrics. I'll kick off step 1 (creating the feature flag we'll vary on) with the flag-create skill, and then we'll pick metrics with the metric-choose skill. Sound good?"

**What the destination expects from you:**

- Confirmation of what's being experimented on (flag vs AI Config). The metric skills are mode-agnostic but step 1 is not.

---

## `observability` → docs-led path

**Destination:** No observability-onboarding skill exists in this repo yet. Hand off to:

- LaunchDarkly Observability product docs: https://launchdarkly.com/docs/home/observability
- The observability SDK install for the user's stack:
  - Browser / web: https://launchdarkly.com/docs/sdk/observability/browser
  - React Native: https://launchdarkly.com/docs/sdk/observability/react-native
  - Server (Node, Python, Go): https://launchdarkly.com/docs/sdk/observability/server
- The observability MCP server when it ships (currently feature-management + AI-Configs MCP servers exist; observability MCP is not yet released to the public surface).

**How to invoke:**

- Tell the user honestly that there is no agent-driven onboarding skill for observability yet.
- Offer to walk through the docs step-by-step: detect their stack, link to the right SDK install page, help them paste the init snippet, and confirm events show up in the dashboard.
- Do **not** pretend to call a non-existent skill. If your runtime exposes `/onboarding-observability`, fall back to the docs-led flow.

**Sample handoff line:**

> "Going to start you on **Observability** — heads up: there's no dedicated onboarding skill for this surface yet, so this'll be a docs-led walkthrough. I'll grab the right SDK install page for your stack (looks like a React app) and we'll wire up session replay + error tracking together. Want to go ahead?"

**What the destination expects from you:**

- The user's stack (browser, React Native, Node, etc.) so you can link the right install page on the first try.
- An honest expectation that this path is more manual than the others.

---

## Edge cases

### User has multiple stated intents (e.g. "AI Configs and flags")

Pick one primary based on the precedence in [decision-signals.md](decision-signals.md) and call out the secondary in your handoff. Sample:

> "Starting you on **AI Configs** since that's where the immediate value is for an LLM-heavy app, but I noticed you mentioned feature flags too — once your AI Config is set up, ask me to onboard flags and we'll route there next."

### User says "everything" or "set me up with all of it"

Route to `flags` first. Flags are the foundation; the other surfaces compose on top. Tell them this in the handoff:

> "Going to start with **Feature Flags** — they're the foundation everything else builds on. Once you have a flag flowing, AI Configs / Experiments / Observability are quick add-ons."

### User asks a question instead of asking for onboarding

E.g. "What's the difference between AI Configs and feature flags?" Don't route — answer the question briefly using the [surfaces.md](surfaces.md) descriptions, then ask which they'd like to start with.

### User is already onboarded for one surface and wants the next

E.g. they have `@launchdarkly/node-server-sdk` already and ask "what should I add next." Route to whichever surface they don't have yet, with a note that the existing `flags` integration is fine.

### The structured-question tool isn't available

Render the same four options as a numbered list and stop. Wait for the user's reply before doing anything else. Do not pick a default.
