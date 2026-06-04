---
name: mcp-configure
description: "Configure the LaunchDarkly hosted MCP server during onboarding. Use when the parent LaunchDarkly onboarding skill reaches Step 4 (MCP). Supports Cursor, Claude Code, Windsurf, GitHub Copilot, and other MCP-compatible agents. OAuth authentication; no API keys for the hosted server."
license: Apache-2.0
compatibility: Requires an MCP-compatible coding agent and a LaunchDarkly account
metadata:
  author: launchdarkly
  version: "0.1.0"
---

# LaunchDarkly MCP Server Configuration (onboarding)

Configures the LaunchDarkly hosted MCP server so flag management skills and onboarding can use MCP tools. Uses OAuth for authentication — no API keys needed for the hosted server.

This skill is nested under [LaunchDarkly onboarding](../SKILL.md); the parent skill's **Step 4** hands off here. **Hosted MCP** is the default and the only supported option for this onboarding flow.

## Prerequisites

- A LaunchDarkly account (sign up at the resolved signup URL — see [Source Attribution](../SKILL.md#source-attribution) in the parent skill; default: `https://app.launchdarkly.com/signup?source=agent`)
- An MCP-compatible coding agent

## Hosted MCP Server

LaunchDarkly provides a unified hosted MCP server that handles feature management, AgentControl, and other LaunchDarkly capabilities.

| Server      | URL                                              | Purpose                                      |
| ----------- | ------------------------------------------------ | -------------------------------------------- |
| LaunchDarkly | `https://mcp.launchdarkly.com/mcp/launchdarkly` | Feature flags, AgentControl, and more |

## Workflow

### Step 1: Detect the Agent

If the parent onboarding skill already identified the agent, use that context. Otherwise infer from agent-specific directories, config files, and the tools available to you at runtime. Do not ask the user — pick the strongest match.

### Step 2: Try Quick Install

The fastest path is the quick install link. Present it to the user:

**LaunchDarkly MCP:** [https://mcp.launchdarkly.com/mcp/launchdarkly/install](https://mcp.launchdarkly.com/mcp/launchdarkly/install)

**Important: tell the user what to expect after clicking the link.** The install link may open in the browser, but the authorization or "add server" prompt typically appears **back in the coding environment** (the editor or host app where the agent runs), not in the browser. Immediately after presenting the link, include guidance like:

- After clicking the link, watch your coding environment (the editor where this conversation is running) for an approval dialog, an "add MCP server" prompt, or a tools/integrations panel notification.
- The browser may start the OAuth flow, but you'll likely need to confirm or approve the server in the editor itself.
- **If no prompt appears:** check the editor's MCP, integrations, or tools settings area to see if the server was added but needs to be enabled. If it's not there at all, fall back to manual setup (Step 3 below).

If the quick install link doesn't work (agent doesn't support it, or user prefers manual setup), proceed to Step 3.

### Step 3: Manual Configuration

Locate the MCP config file for the detected agent and add the hosted server entry. See [MCP Config Templates](references/mcp-config-templates.md) for the exact JSON per agent.

| Agent          | Config file location                                       |
| -------------- | ---------------------------------------------------------- |
| Cursor         | `.cursor/mcp.json` (project) or global Cursor settings     |
| Claude Code    | `.mcp.json` (project) or `~/.claude.json` (global)         |
| GitHub Copilot | Repo **Settings** on GitHub.com → Copilot → Cloud agent → MCP (see [MCP UI links](references/mcp-ui-links.md)) |
| Windsurf       | Agent-specific MCP config                                  |

The unified server handles both feature management and AgentControl, so only one server entry is needed.

### Step 4: Agent-Specific Authorization

After writing the config, some agents need extra steps. **Do not** send users through long manual menu paths only—use [MCP UI links](references/mcp-ui-links.md) (HTTPS docs + `command:` shortcuts for VS Code / Cursor).

**Cursor:**

1. Open MCP in Cursor using the [Cursor MCP doc link and in-app shortcuts](references/mcp-ui-links.md#clients) (e.g. Settings search via `command:` link when clickable).
2. Toggle on **LaunchDarkly** (or the name from your config).
3. Click **Connect** to authorize with the LaunchDarkly account.

**VS Code (when applicable):**

- Use [VS Code MCP doc + `mcp.json` / Settings links](references/mcp-ui-links.md#clients); trust or start the server if prompted.

**Claude Code:**

- Authorization happens automatically on first MCP tool call via OAuth prompt. File-based setup: [Claude Code MCP doc](https://docs.claude.com/en/docs/claude-code/mcp).

**GitHub Copilot:**

- Click **Save** after adding the MCP configuration in repo settings. Use the [GitHub Copilot MCP doc](https://docs.github.com/en/copilot/customizing-copilot/extending-copilot-coding-agent-with-mcp) for the exact **Settings** path on github.com.

### Step 5: Enable and Verify

After adding the config, the user needs to enable and authorize the server. MCP tools may become available immediately in some agents (Cursor, Claude Code) without a restart.

1. **Tell the user to enable the server.** They need to toggle on the LaunchDarkly server and complete OAuth in their editor's MCP settings (e.g. in Cursor: toggle on the server and click **Connect**).
2. **Probe immediately.** After the user confirms they've enabled the server, call a lightweight MCP tool (e.g. `list-feature-flags` with the known project key). Do not ask the user whether MCP is working — just try it.
   - **Success** (normal response, even an empty flag list): MCP is live. Note it in the onboarding log and continue.
   - **Failure** (tool not found, auth error, timeout): **update the onboarding log first** (set Step 4 to "in progress - pending restart", Next step to "Step 4: Verify MCP after restart"), then suggest a restart with clear resume instructions:
     > "MCP tools aren't available yet. Try restarting your editor. When you come back, just say **'continue LaunchDarkly onboarding'** — I'll pick up where we left off using the onboarding log."
3. **If restart doesn't help**, fall back to ldcli/API for Steps 5-6. Note the fallback in the onboarding log. Do **not** block the rest of onboarding.
4. If the failure looks like a config issue (wrong file path, missing OAuth, server not enabled), mention the likely cause so the user can fix it on their own time — but do not block progress.

## Edge Cases

- **User already has MCP configured:** Verify by checking for existing LD MCP entries in the config.
  - `mcp/launchdarkly` → working, skip configuration
  - `mcp/fm` or `mcp/aiconfigs` → deprecated, ask before migrating:

    **D-MIGRATE -- BLOCKING:** Call your structured question tool now.
    - question: "I see you have a deprecated MCP server configured (`mcp/fm` and/or `mcp/aiconfigs`). Those endpoints are deprecated — the unified server at `mcp/launchdarkly` now handles both feature management and AgentControl. Want me to update your config?"
    - options:
      - "Yes, update my config to use the unified server"
      - "No, leave it as is for now"
    - STOP. Do not modify the MCP config before the user selects an option.

    If they agree, remove the deprecated entries and ensure the unified `mcp/launchdarkly` config is present. See [MCP Config Templates](references/mcp-config-templates.md). If they decline, note the deprecation and continue.
- **User has the old npx-based local server:** Migrate them. Remove the old `npx @launchdarkly/mcp-server` entry and any `LD_ACCESS_TOKEN` env vars. Replace with the hosted server config. See [MCP Config Templates — Migration](references/mcp-config-templates.md#migrating-from-old-configurations).
- **Agent not in known list:** Provide the generic pattern: the user needs to add an MCP server entry pointing to `https://mcp.launchdarkly.com/mcp/launchdarkly` using whatever format their agent expects.
- **User opts out of MCP during onboarding:** Document that choice and continue with the parent skill's ldcli/API fallbacks for environments and flags; do not block SDK work.

## What NOT to Do

- Don't configure the old npx-based local server. Use the hosted server.
- Don't ask for or store API keys for the hosted server. The hosted server uses OAuth.
- Don't configure the old separate FM/AgentControl servers. Use the unified `mcp/launchdarkly` server.

## References

- [MCP UI links](references/mcp-ui-links.md) — HTTPS + `command:` links to open MCP settings (Cursor, VS Code, Claude Code, Windsurf, GitHub)
- [MCP Config Templates](references/mcp-config-templates.md) — hosted OAuth JSON per agent; migration from old configurations
- [Official MCP docs](https://launchdarkly.com/docs/home/getting-started/mcp-hosted) — full hosted setup guide
