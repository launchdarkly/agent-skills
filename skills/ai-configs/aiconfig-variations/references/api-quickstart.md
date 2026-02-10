# Variations API Quick Start

Create, update, and manage variations using the LaunchDarkly API.

## Create Variation (Agent Mode)

```bash
curl -X POST \
  https://app.launchdarkly.com/api/v2/projects/{projectKey}/ai-configs/{configKey}/variations \
  -H "Authorization: api-xxxxx" \
  -H "Content-Type: application/json" \
  -H "LD-API-Version: beta" \
  -d '{
    "key": "gpt4o-variant",
    "name": "GPT-4o Variant",
    "instructions": "You are a helpful assistant.",
    "modelConfigKey": "OpenAI.gpt-4o",
    "model": {
      "modelName": "gpt-4o",
      "parameters": {
        "temperature": 0.7,
        "maxTokens": 1500
      }
    }
  }'
```

## Create Variation (Completion Mode)

```bash
curl -X POST \
  https://app.launchdarkly.com/api/v2/projects/{projectKey}/ai-configs/{configKey}/variations \
  -H "Authorization: api-xxxxx" \
  -H "Content-Type: application/json" \
  -H "LD-API-Version: beta" \
  -d '{
    "key": "claude-variant",
    "name": "Claude Variant",
    "messages": [
      {"role": "system", "content": "You are helpful."},
      {"role": "user", "content": "{{user_input}}"}
    ],
    "modelConfigKey": "Anthropic.claude-sonnet-4-5",
    "model": {
      "modelName": "claude-sonnet-4-5",
      "parameters": {
        "temperature": 0.8,
        "maxTokens": 2000
      }
    }
  }'
```

## Update Variation

```bash
curl -X PATCH \
  https://app.launchdarkly.com/api/v2/projects/{projectKey}/ai-configs/{configKey}/variations/{variationKey} \
  -H "Authorization: api-xxxxx" \
  -H "Content-Type: application/json" \
  -H "LD-API-Version: beta" \
  -d '{
    "instructions": "Updated instructions...",
    "model": {
      "parameters": {
        "temperature": 0.5,
        "maxTokens": 1000
      }
    }
  }'
```

## List Variations

```bash
curl -X GET \
  https://app.launchdarkly.com/api/v2/projects/{projectKey}/ai-configs/{configKey} \
  -H "Authorization: api-xxxxx" \
  -H "LD-API-Version: beta"
```

## Delete Variation

```bash
curl -X DELETE \
  https://app.launchdarkly.com/api/v2/projects/{projectKey}/ai-configs/{configKey}/variations/{variationKey} \
  -H "Authorization: api-xxxxx" \
  -H "LD-API-Version: beta"
```

## modelConfigKey Format

`{Provider}.{model-id}` — e.g., `OpenAI.gpt-4o`, `Anthropic.claude-sonnet-4-5`

## Attach Tools

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
