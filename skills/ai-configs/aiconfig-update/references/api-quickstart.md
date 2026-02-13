# Update API Quick Start

Update and delete AI Configs using the LaunchDarkly API.

## Update Config Metadata

```bash
curl -X PATCH \
  https://app.launchdarkly.com/api/v2/projects/{projectKey}/ai-configs/{configKey} \
  -H "Authorization: api-xxxxx" \
  -H "Content-Type: application/json" \
  -H "LD-API-Version: beta" \
  -d '{
    "name": "Updated Name",
    "description": "Updated description"
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
        "maxTokens": 1500
      }
    }
  }'
```

## Archive Config

```bash
curl -X PATCH \
  https://app.launchdarkly.com/api/v2/projects/{projectKey}/ai-configs/{configKey} \
  -H "Authorization: api-xxxxx" \
  -H "Content-Type: application/json" \
  -H "LD-API-Version: beta" \
  -d '{"archived": true}'
```

## Delete Config

```bash
curl -X DELETE \
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

## Verify Update

```bash
curl -X GET \
  https://app.launchdarkly.com/api/v2/projects/{projectKey}/ai-configs/{configKey}/variations/{variationKey} \
  -H "Authorization: api-xxxxx" \
  -H "LD-API-Version: beta"
```
