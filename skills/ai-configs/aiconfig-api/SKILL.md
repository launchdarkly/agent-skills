---
name: aiconfig-api
description: Access LaunchDarkly AI Configs through the REST API. Learn how to authenticate and perform operations not available through SDKs.
compatibility: Requires LaunchDarkly account and project with AI Configs enabled.
metadata:
  author: launchdarkly
  version: "0.1.0"
---

# AI Config API Access

Access LaunchDarkly AI Configs through the REST API to perform operations not available through SDKs, including creating, updating, and managing AI Configs programmatically.

## Prerequisites

- LaunchDarkly account with AI Configs enabled
- Project where you want to manage AI Configs
- Understanding of REST API concepts

## MCP Server vs REST API

The [LaunchDarkly MCP server](https://docs.launchdarkly.com/home/getting-started/launchdarkly-mcp-server) provides basic AI Config operations via natural language in AI clients (Claude, Cursor, etc.).

**MCP tools available:**
- `list-ai-configs`, `get-ai-config`, `create-ai-config`, `update-ai-config`, `delete-ai-config`
- `get-ai-config-variation`, `create-ai-config-variation`, `update-ai-config-variation`, `delete-ai-config-variation`

**Current MCP limitations** (see [issue #40](https://github.com/launchdarkly/mcp-server/issues/40)):
- Cannot configure `tools`, `model.parameters`, `customParameters`, or `judgeConfiguration` on variations
- No endpoints for managing AI tool definitions (`/ai-tools`)
- Targeting, segments, and metrics operations not available

**Recommendation:** Use the REST API (documented below) for full AI Config functionality. MCP is useful for basic listing and skeleton creation only.

### Configure MCP Server

If you want to use MCP for basic operations, configure it in your AI client:

**Claude Code (`~/.claude/mcp.json`):**
```json
{
  "mcpServers": {
    "launchdarkly": {
      "command": "npx",
      "args": ["-y", "@launchdarkly/mcp-server", "start"],
      "env": {
        "LD_ACCESS_TOKEN": "your-api-token"
      }
    }
  }
}
```

**Cursor (`.cursor/mcp.json`):**
```json
{
  "mcpServers": {
    "launchdarkly": {
      "command": "npx",
      "args": ["-y", "@launchdarkly/mcp-server", "start"],
      "env": {
        "LD_ACCESS_TOKEN": "your-api-token"
      }
    }
  }
}
```

Replace `your-api-token` with your LaunchDarkly API access token. After configuring, restart your AI client.

For more details, see the [LaunchDarkly MCP Server Documentation](https://docs.launchdarkly.com/home/getting-started/launchdarkly-mcp-server).

## Getting an API Access Token

### Create a Personal Access Token

1. Navigate to [Authorization settings](https://app.launchdarkly.com/settings/authorization)
2. Click **Create token**
3. Name your token (e.g., "AI Config Management")
4. Set token permissions:
   - **Required**: `ai-configs:write` - Full access to AI Configs
   - **Optional**: `projects:read` - Read project information
   - **Optional**: `environments:read` - Read environment data
5. Set API version (recommended: latest version)
6. Click **Save token**
7. **Copy and save the token immediately** - it won't be shown again

### Token Security Best Practices

- **Never commit tokens to version control**
- Store tokens in environment variables or secret managers
- Rotate tokens regularly
- Use service tokens for production applications
- Limit token permissions to minimum required

## API Authentication

Include your token in the `Authorization` header for all requests:

```python
import requests

headers = {
    "Authorization": "YOUR_API_TOKEN",
    "Content-Type": "application/json",
    "LD-API-Version": "beta"  # Required for AI Config endpoints
}
```

## Operations Only Available via API

The following operations can **only** be done through the API, not through SDKs:

### 1. Create AI Configs
SDKs can only read AI Configs. Creating new configs requires the API.
See: `aiconfig-create` skill

### 2. Update AI Configs and Variations
Modifying existing configs, variations, or settings requires the API.
See: `aiconfig-update` and `aiconfig-variations` skills

### 3. Delete AI Configs
Removing configs entirely requires the API.
See: `aiconfig-update` skill

### 4. Manage Tools
Creating, updating, and deleting tools for function calling requires the API.
See: `aiconfig-tools` skill

### 5. Configure Targeting Rules
Setting up targeting rules for AI Configs requires the API.
See: `aiconfig-targeting` skill

### 6. List and Search Operations
Listing all AI Configs in a project requires the API:

```python
def list_ai_configs(project_key, api_token):
    """List all AI Configs in a project"""
    url = f"https://app.launchdarkly.com/api/v2/projects/{project_key}/ai-configs"

    headers = {
        "Authorization": api_token,
        "LD-API-Version": "beta"
    }

    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        configs = response.json()
        for config in configs.get("items", []):
            print(f"- {config['key']}: {config['name']}")
        return configs
    else:
        print(f"Error: {response.status_code}")
        return None
```

## API vs SDK Comparison

| Operation | API | SDK | Notes |
|-----------|-----|-----|-------|
| **Create** AI Configs | ✅ | ❌ | API only |
| **Read** AI Config values | ✅ | ✅ | SDK optimized for runtime |
| **Update** configurations | ✅ | ❌ | API only |
| **Delete** AI Configs | ✅ | ❌ | API only |
| **Evaluate** variations | ❌ | ✅ | SDK only - determines which variation to serve |
| **Track** metrics | ❌ | ✅ | SDK only - sends usage data |
| **Manage** tools | ✅ | ❌ | API only |
| **Configure** targeting | ✅ | ❌ | API only |

## Common API Patterns

### Error Handling

```python
def api_request(method, url, headers, json_data=None):
    """Make API request with error handling"""
    try:
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=json_data)
        elif method == "PATCH":
            response = requests.patch(url, headers=headers, json=json_data)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers)

        if response.status_code in [200, 201, 204]:
            return {"success": True, "data": response.json() if response.text else None}
        elif response.status_code == 400:
            return {"success": False, "error": "Bad request - check your data"}
        elif response.status_code == 401:
            return {"success": False, "error": "Invalid or missing API token"}
        elif response.status_code == 403:
            return {"success": False, "error": "Insufficient permissions"}
        elif response.status_code == 404:
            return {"success": False, "error": "Resource not found"}
        elif response.status_code == 429:
            return {"success": False, "error": "Rate limited - wait and retry"}
        else:
            return {"success": False, "error": f"HTTP {response.status_code}"}

    except requests.exceptions.RequestException as e:
        return {"success": False, "error": str(e)}
```

### Pagination

Many API endpoints return paginated results:

```python
def get_all_configs(project_key, api_token):
    """Get all AI Configs with pagination"""
    all_configs = []
    limit = 20
    offset = 0

    while True:
        url = f"https://app.launchdarkly.com/api/v2/projects/{project_key}/ai-configs"
        url += f"?limit={limit}&offset={offset}"

        result = api_request("GET", url, {"Authorization": api_token, "LD-API-Version": "beta"})

        if not result["success"]:
            break

        items = result["data"].get("items", [])
        all_configs.extend(items)

        # Check if more pages exist
        if len(items) < limit:
            break

        offset += limit

    return all_configs
```

## Environment-Specific URLs

### Production (Default)
```
https://app.launchdarkly.com/api/v2
```

### Federal
```
https://app.launchdarkly.us/api/v2
```

### European Union
```
https://app.eu.launchdarkly.com/api/v2
```

## Rate Limiting

LaunchDarkly API has rate limits to ensure availability:

- **Global limit**: Account-wide limit per 10 seconds
- **Route limit**: Per-endpoint limit per 10 seconds
- **429 responses**: Indicate rate limiting
- **Retry-After header**: Specifies wait time

Handle rate limits gracefully:

```python
import time

def retry_with_backoff(func, max_retries=3):
    """Retry function with exponential backoff"""
    for attempt in range(max_retries):
        result = func()

        if result.get("success"):
            return result

        if "rate limited" in result.get("error", "").lower():
            wait_time = 2 ** attempt  # Exponential backoff
            print(f"Rate limited, waiting {wait_time} seconds...")
            time.sleep(wait_time)
        else:
            return result

    return {"success": False, "error": "Max retries exceeded"}
```

## Quick Reference

### Essential Headers

```python
headers = {
    "Authorization": "YOUR_API_TOKEN",     # Required
    "Content-Type": "application/json",    # For POST/PATCH
    "LD-API-Version": "beta"               # For AI Config endpoints
}
```

### Base URLs

```python
# Choose based on your environment
BASE_URL = "https://app.launchdarkly.com/api/v2"  # Production
# BASE_URL = "https://app.launchdarkly.us/api/v2"  # Federal
# BASE_URL = "https://app.eu.launchdarkly.com/api/v2"  # EU
```

### Common Endpoints

```python
# AI Configs
f"{BASE_URL}/projects/{project}/ai-configs"  # List/Create
f"{BASE_URL}/projects/{project}/ai-configs/{key}"  # Get/Update/Delete

# Variations
f"{BASE_URL}/projects/{project}/ai-configs/{key}/variations"  # List/Create
f"{BASE_URL}/projects/{project}/ai-configs/{key}/variations/{var_key}"  # Get/Update/Delete

# Tools
f"{BASE_URL}/projects/{project}/ai-tools"  # List/Create
f"{BASE_URL}/projects/{project}/ai-tools/{key}"  # Get/Update/Delete

# AI Config Metrics (read AI usage metrics)
f"{BASE_URL}/projects/{project}/ai-configs/{key}/metrics?from={start}&to={end}&env={env}"  # Get

# Custom Metrics (manage metric definitions)
f"{BASE_URL}/metrics/{project}"  # List/Create
f"{BASE_URL}/metrics/{project}/{metric_key}"  # Get/Update/Delete

# Segments (for targeting)
f"{BASE_URL}/segments/{project}/{env}"  # List/Create
f"{BASE_URL}/segments/{project}/{env}/{segment_key}"  # Get/Update/Delete

# Projects
f"{BASE_URL}/projects"  # List/Create
f"{BASE_URL}/projects/{project}"  # Get/Update/Delete
f"{BASE_URL}/projects/{project}/environments"  # List environments
```

## Next Steps

After setting up API access:
1. **Create AI Configs** - See `aiconfig-create`
2. **Manage variations** - See `aiconfig-variations`
3. **Configure tools** - See `aiconfig-tools`
4. **Set up targeting** - See `aiconfig-targeting`
5. **Integrate with SDKs** - See `aiconfig-sdk`

## Related Skills

### Core Operations
- `aiconfig-create` - Create configs via API
- `aiconfig-update` - Update configs via API
- `aiconfig-projects` - Manage projects via API

### SDK Integration
- `aiconfig-sdk` - SDK vs API usage
- `aiconfig-variations` - Manage variations via API
- `aiconfig-tools` - Manage tools via API
## References

- [LaunchDarkly API Documentation](https://apidocs.launchdarkly.com)
- [AI Configs API Reference](https://apidocs.launchdarkly.com/#tag/AI-Configs)
- [Authentication Guide](https://docs.launchdarkly.com/home/account/api)
- [API Best Practices](https://docs.launchdarkly.com/guides/api/best-practices)
- [Rate Limiting](https://apidocs.launchdarkly.com#section/Rate-limiting)