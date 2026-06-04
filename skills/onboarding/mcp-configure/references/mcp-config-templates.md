# MCP Config Templates

Per-agent JSON snippets for configuring the LaunchDarkly hosted MCP server. All configurations use OAuth — no API keys required.

Source: https://launchdarkly.com/docs/home/getting-started/mcp-hosted

## Cursor

Config file: `.cursor/mcp.json` in the project root.

```json
{
  "mcpServers": {
    "LaunchDarkly": {
      "url": "https://mcp.launchdarkly.com/mcp/launchdarkly",
      "headers": {}
    }
  }
}
```

**After adding the config:** enable the server and complete OAuth in Cursor's MCP UI. Use [MCP UI links — Cursor](mcp-ui-links.md#clients) (HTTPS doc + optional `command:` links); do not rely only on nested Settings menu paths.

## Claude Code

Config file: `.mcp.json` in the project root, or `~/.claude.json` for global config.

```json
{
  "mcpServers": {
    "LaunchDarkly": {
      "type": "http",
      "url": "https://mcp.launchdarkly.com/mcp/launchdarkly"
    }
  }
}
```

Authorization happens automatically via OAuth prompt on first MCP tool call.

## GitHub Copilot

Configured via the GitHub web UI, not a local config file.

1. Navigate to the target repository on GitHub
2. Go to **Settings > Code and automation > Copilot > Coding agent**
3. In the **MCP configuration** section, add:

```json
{
  "mcpServers": {
    "LaunchDarkly": {
      "url": "https://mcp.launchdarkly.com/mcp/launchdarkly",
      "headers": {}
    }
  }
}
```

4. Click **Save**

## Windsurf

Windsurf uses a similar MCP configuration format. Add to the agent's MCP config:

```json
{
  "mcpServers": {
    "LaunchDarkly": {
      "url": "https://mcp.launchdarkly.com/mcp/launchdarkly"
    }
  }
}
```

Consult Windsurf's documentation for the exact config file location.

## Migrating from Old Configurations

### From the old local npx-based server

If the user has the old npx-based server configured, replace it:

**Remove this:**

```json
{
  "mcpServers": {
    "LaunchDarkly": {
      "command": "npx",
      "args": [
        "-y", "--package", "@launchdarkly/mcp-server",
        "--", "mcp", "start",
        "--api-key", "api-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      ]
    }
  }
}
```

**Replace with the hosted config for the relevant agent** (see sections above).

Also remove any `LD_ACCESS_TOKEN` or `LAUNCHDARKLY_API_KEY` environment variables that were used for the local server. The hosted server handles authentication via OAuth.

### From deprecated split servers (`mcp/fm` and `mcp/aiconfigs`)

Both `mcp/fm` and `mcp/aiconfigs` are deprecated. All functionality is now in the unified server (`mcp/launchdarkly`).

If the user has either endpoint configured, **ask before removing** — see the edge case flow in [SKILL.md](../SKILL.md#edge-cases). The user should confirm the migration.

**Entries to remove (after user confirms):**

```json
{
  "mcpServers": {
    "LaunchDarkly Feature Management": {
      "url": "https://mcp.launchdarkly.com/mcp/fm"
    },
    "LaunchDarkly AgentControl": {
      "url": "https://mcp.launchdarkly.com/mcp/aiconfigs"
    }
  }
}
```

**Replace with the single unified server** (see sections above).
