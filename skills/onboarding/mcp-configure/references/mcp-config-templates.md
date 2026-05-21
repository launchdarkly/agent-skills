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

## Local server via `npx`

Use the local MCP server when hosted MCP is not available — for example, **EU or Federal** environments — or when your setup requires it. See [local MCP server docs](https://launchdarkly.com/docs/home/getting-started/mcp-local). This path uses **`LAUNCHDARKLY_ACCESS_TOKEN`** (API access token) instead of OAuth.

### Security: Protect tokens in MCP config files

Most editors (Cursor, VS Code, Claude Desktop) require **literal tokens** in MCP config — they don't expand `${VAR}` syntax. To prevent accidental commits:

1. **Add MCP config files to `.gitignore`:**
   ```
   .cursor/mcp.json
   .vscode/mcp.json
   ```
2. **Or use user-level config** (outside the repo) where the editor supports it

**Exception:** Claude Code supports `${LAUNCHDARKLY_ACCESS_TOKEN}` env var syntax — use it when available.

### Claude Code (project `.mcp.json`)

```json
{
  "mcpServers": {
    "launchdarkly": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@launchdarkly/mcp-server"],
      "env": {
        "LAUNCHDARKLY_ACCESS_TOKEN": "${LAUNCHDARKLY_ACCESS_TOKEN}"
      }
    }
  }
}
```

Set `LAUNCHDARKLY_ACCESS_TOKEN` in the environment or use your agent’s secret mechanism per [Claude Code MCP docs](https://docs.claude.com/en/docs/claude-code/mcp). For user-wide config, merge the same `mcpServers.launchdarkly` entry into `~/.claude/settings.json` if appropriate.

### Cursor (`.cursor/mcp.json`)

**Add `.cursor/mcp.json` to `.gitignore`** — Cursor requires a literal token value.

```json
{
  "mcpServers": {
    "launchdarkly": {
      "command": "npx",
      "args": ["-y", "@launchdarkly/mcp-server"],
      "env": {
        "LAUNCHDARKLY_ACCESS_TOKEN": "YOUR_ACCESS_TOKEN"
      }
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)

Claude Desktop config is user-level (not in repos), so token exposure risk is lower.

```json
{
  "mcpServers": {
    "launchdarkly": {
      "command": "npx",
      "args": ["-y", "@launchdarkly/mcp-server"],
      "env": {
        "LAUNCHDARKLY_ACCESS_TOKEN": "YOUR_ACCESS_TOKEN"
      }
    }
  }
}
```

### VS Code / Copilot (`.vscode/mcp.json`)

**Add `.vscode/mcp.json` to `.gitignore`** — VS Code requires a literal token value.

```json
{
  "servers": {
    "launchdarkly": {
      "command": "npx",
      "args": ["-y", "@launchdarkly/mcp-server"],
      "env": {
        "LAUNCHDARKLY_ACCESS_TOKEN": "YOUR_ACCESS_TOKEN"
      }
    }
  }
}
```

Replace `YOUR_ACCESS_TOKEN` with the user’s LaunchDarkly API access token. After editing, enable the server in the editor's MCP settings. A restart may be required if tools don't appear.

### Verify (local server)

1. If you have MCP tool access, call **`list-feature-flags`** with the user’s `projectKey` (e.g. `request: { "projectKey": "YOUR_PROJECT_KEY" }`). A normal response confirms the server and token.
2. If MCP tools are not visible yet, have the user run **`ldcli flags list`** (or curl the REST API) to validate credentials independently while waiting for MCP tools to appear.
