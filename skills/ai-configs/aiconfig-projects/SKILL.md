---
name: aiconfig-projects
description: "Create and configure LaunchDarkly projects, extract SDK keys per environment, and verify SDK connectivity. Supports single-project setup, multi-service architectures, cross-region cloning, and IaC automation. Use when the user needs to create a LaunchDarkly project, set up feature flags for a new service, obtain SDK keys, or organize AI Configs across teams or regions."
compatibility: Requires LaunchDarkly API access token with projects:write permission or LaunchDarkly MCP server.
metadata:
  author: launchdarkly
  version: "0.4.0"
---

# LaunchDarkly Projects Setup

## Prerequisites

**Choose one:**
- LaunchDarkly API access token with `projects:write` permission
- LaunchDarkly MCP server configured in your environment

## API Key Detection

Before prompting the user for an API key, try to detect it automatically:

1. **Check environment variables**: Look for `LAUNCHDARKLY_API_KEY`, `LAUNCHDARKLY_API_TOKEN`, or `LD_API_KEY`
2. **Check MCP config**: If using Claude, read `~/.claude/config.json` for `mcpServers.launchdarkly.env.LAUNCHDARKLY_API_KEY`
3. **Prompt user**: Only if detection fails, ask the user for their API key

See [Quick Start](references/quick-start.md) for API usage patterns.

## Project Setup Workflow

### Step 1: Explore and Assess

Identify the tech stack, existing LaunchDarkly usage, environment variable patterns, and the use case (new project, multi-service, cross-region, IaC). Then select the right approach:

| Scenario | Recommended Path |
|----------|------------------|
| New project, no LaunchDarkly integration | [Quick Start](references/quick-start.md) — create project and save SDK keys |
| Existing LaunchDarkly usage | Check existing projects first; create new or reuse |
| Multiple services/microservices | Create one project per service |
| Multi-region or multi-tenant | [Project Cloning](references/project-cloning.md) — clone a template project |
| Infrastructure-as-Code setup | [IaC/Automation](references/iac-automation.md) — Terraform, scripts, CI/CD |

### Step 2: Create the Project

**Via MCP (preferred):**

Use the `create-project` MCP tool:
```json
{
  "name": "My AI Service",
  "key": "my-ai-service",
  "tags": ["ai-configs"]
}
```

**Via REST API:**
```bash
curl -X POST "https://app.launchdarkly.com/api/v2/projects" \
  -H "Authorization: {api_token}" \
  -H "Content-Type: application/json" \
  -d '{"name": "My AI Service", "key": "my-ai-service", "tags": ["ai-configs"]}'
```

Project keys: lowercase, hyphens only, must start with a letter (e.g. `support-ai`, `chat-bot-v2`). Keys are immutable after creation.

**If the API returns 409 Conflict**, the key already exists — use `get-project` to check whether the existing project is the right one before creating a different key.

### Step 3: Choose Implementation Path

Select the reference guide that matches the stack:

**By Language:**
- [Python](references/python-setup.md) — FastAPI, Django, Flask
- [Node.js/TypeScript](references/nodejs-setup.md) — Express, NestJS
- [Go](references/go-setup.md) — Go services
- [Multi-Language](references/multi-language-setup.md) — Polyglot architectures

**By Use Case:**
- [Environment Configuration](references/env-config.md) — Save SDK keys to .env, secrets, or config
- [Admin Tooling](references/admin-tooling.md) — Build CLI or admin utilities

### Step 4: Verify the Setup

1. **Confirm the project exists.** Prefer the MCP `get-project` tool. If using the REST API:
   ```bash
   curl -X GET "https://app.launchdarkly.com/api/v2/projects/{projectKey}?expand=environments" \
     -H "Authorization: {api_token}"
   ```
   The shape of `environments` varies by `expand` parameter — sometimes `{items: [...]}`, sometimes a bare array. Use `jq '.environments | if type == "object" then .items else . end'` to handle both.

2. **Test SDK connectivity:**
   ```python
   import ldclient
   from ldclient.config import Config

   ldclient.set_config(Config("{sdk_key}"))
   ldclient.get().flush()
   ldclient.get().close()
   ```

3. **If verification fails:**
   - SDK initialization error → check the SDK key matches the correct environment (Production vs Test)
   - 401/403 from API → confirm the API token has `projects:write` permission
   - Project missing environments → re-create or contact LaunchDarkly support

4. **Report results:**
   - ✓ Project exists and has environments
   - ✓ SDK keys are present and valid
   - ✓ SDK can initialize

## Edge Cases

| Situation | Action |
|-----------|--------|
| Project already exists (409) | Use `get-project` to inspect; reuse or pick a different key |
| Token lacks permissions | Request `projects:write` or use MCP server |
| Multiple projects needed | Create separately for each service/region/team |
| Shared configs across services | Use same project, separate by SDK context |

## Next Steps

- **Create AI Configs** — `aiconfig-create`
- **Set up SDK Integration** — `aiconfig-sdk`
- **Configure Targeting** — `aiconfig-targeting`
- **Manage Variations** — `aiconfig-variations`

## References

- [Quick Start Guide](references/quick-start.md)
- [Python](references/python-setup.md) · [Node.js](references/nodejs-setup.md) · [Go](references/go-setup.md) · [Multi-Language](references/multi-language-setup.md)
- [Environment Configuration](references/env-config.md) · [Project Cloning](references/project-cloning.md)
- [IaC/Automation](references/iac-automation.md) · [Admin Tooling](references/admin-tooling.md)
