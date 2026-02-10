# Tools API Quick Start

Create and manage tools using the LaunchDarkly API.

**Endpoint:** `https://app.launchdarkly.com/api/v2/projects/{projectKey}/ai-tools`  
Do NOT use `/ai-configs/tools` — that endpoint does not exist.

## Create a Tool

```bash
curl -X POST \
  https://app.launchdarkly.com/api/v2/projects/{projectKey}/ai-tools \
  -H "Authorization: api-xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "search-database",
    "description": "Search the customer database",
    "schema": {
      "type": "function",
      "function": {
        "name": "search_database",
        "description": "Search for records",
        "parameters": {
          "type": "object",
          "properties": {
            "query": {"type": "string", "description": "Search query"},
            "limit": {"type": "integer", "default": 10}
          },
          "required": ["query"]
        }
      }
    }
  }'
```

## Attach to Variation

```bash
curl -X PATCH \
  https://app.launchdarkly.com/api/v2/projects/{projectKey}/ai-configs/{configKey}/variations/{variationKey} \
  -H "Authorization: api-xxxxx" \
  -H "Content-Type: application/json" \
  -H "LD-API-Version: beta" \
  -d '{
    "model": {
      "parameters": {
        "tools": [
          {"key": "search-database", "version": 1}
        ]
      }
    }
  }'
```

## List Tools

```bash
curl -X GET \
  https://app.launchdarkly.com/api/v2/projects/{projectKey}/ai-tools \
  -H "Authorization: api-xxxxx"
```

## Get Tool

```bash
curl -X GET \
  https://app.launchdarkly.com/api/v2/projects/{projectKey}/ai-tools/{toolKey} \
  -H "Authorization: api-xxxxx"
```

## Schema Format

Use OpenAI function calling format:

```json
{
  "type": "function",
  "function": {
    "name": "function_name",
    "description": "What the LLM uses to decide when to call",
    "parameters": {
      "type": "object",
      "properties": { ... },
      "required": [ ... ]
    }
  }
}
```
