---
name: aiconfig-variations
description: Manage AI Config variations - add, update, retrieve, and delete variations from existing configs. Test different models, prompts, parameters, and tools within a single AI Config.
compatibility: Requires LaunchDarkly API access token with ai-configs:write permission.
metadata:
  author: launchdarkly
  version: "0.1.0"
---

# AI Config Variations Management

Add, update, retrieve, and delete variations from existing AI Configs to test different models, prompts, parameters, and tools.

## Prerequisites

- LaunchDarkly API access token with `ai-configs:write` permission
- Project key and existing AI Config key
- Understanding of agent vs completion mode

> **Note:** The LaunchDarkly MCP server has variation tools (`create-ai-config-variation`, etc.), but they cannot configure tools, model parameters, or custom parameters. Use the REST API below for full functionality. See `aiconfig-api` for details.

## What Are Variations?

Variations allow you to:
- Test multiple AI models (GPT-4 vs Claude vs Gemini)
- Compare different prompts or instructions
- Experiment with parameter tuning
- Attach different tools to each variation
- Configure Online Evaluations (judges) per variation
- A/B test configurations without code changes

## Python Examples

### Example 1: Add Agent Mode Variations

```python
import requests
import os
import time

API_TOKEN = os.environ.get("LAUNCHDARKLY_API_TOKEN")
PROJECT_KEY = "support-ai"

def add_agent_variations(config_key: str):
    """Add variations to an existing agent mode AI Config."""
    variations = [
        {
            "key": "base-config",
            "name": "Base Configuration",
            "instructions": """You are a helpful customer support agent.

Your responsibilities:
- Answer customer questions
- Resolve issues efficiently
- Maintain a friendly tone

Company: {{company_name}}
Priority: {{support_priority}}""",
            "messages": [],  # Required for agent mode
            "model": {
                "modelName": "gpt-4",
                "parameters": {
                    "temperature": 0.7,
                    "maxTokens": 2000,
                    # Optional: custom parameters for your application
                    "custom_param": "value",
                    "enable_feature": True
                }
            },
            # Optional: tools created via aiconfig-tools skill
            "tools": [
                {"key": "search_knowledge_base", "version": 1},
                {"key": "get_customer_info", "version": 1}
            ]
        },
        {
            "key": "advanced-config",
            "name": "Advanced Configuration",
            "instructions": """You are an expert customer support specialist.

Provide detailed assistance with:
- Complex technical issues
- Account management
- Product recommendations

Company: {{company_name}}
Priority: {{support_priority}}""",
            "messages": [],  # Required for agent mode
            "model": {
                "modelName": "gpt-4-turbo",
                "parameters": {
                    "temperature": 0.5,
                    "maxTokens": 4000,
                    "reasoning_depth": "deep"
                }
            },
            "tools": [
                {"key": "search_knowledge_base", "version": 1},
                {"key": "get_customer_info", "version": 1}
            ]
        }
    ]

    # Add each variation
    url = f"https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-configs/{config_key}/variations"
    headers = {
        "Authorization": API_TOKEN,
        "Content-Type": "application/json",
        "LD-API-Version": "beta"
    }

    created_variations = []

    for variation in variations:
        response = requests.post(url, headers=headers, json=variation)

        if response.status_code in [200, 201]:
            print(f"  [OK] Added variation: {variation['key']}")
            created_variations.append(variation['key'])
            time.sleep(0.5)
        else:
            print(f"  [ERROR] Failed to add variation {variation['key']}: {response.text}")

    if created_variations:
        print(f"\n[OK] Added {len(created_variations)} variations to '{config_key}'")
        print(f"  URL: https://app.launchdarkly.com/projects/{PROJECT_KEY}/ai-configs/{config_key}")
        return True

    return False

# Execute
if __name__ == "__main__":
    add_agent_variations("support-agent")
```

### Example 2: Add Completion Mode Variations

```python
def add_completion_variations(config_key: str):
    """Add variations to an existing completion mode AI Config."""
    variations = [
        {
            "key": "creative",
            "name": "Creative Style",
            "messages": [
                {"role": "system", "content": "You are a creative content writer for {{brand}}."},
                {"role": "user", "content": "{{content_request}}"}
            ],
            "model": {
                "modelName": "gpt-4",
                "parameters": {
                    "temperature": 0.9,
                    "maxTokens": 2000,
                    # Optional: custom parameters
                    "style_guide": "creative"
                }
            },
            # Optional: tools created via aiconfig-tools skill
            "tools": [
                {"key": "search_knowledge_base", "version": 1},
                {"key": "get_customer_info", "version": 1}
            ]
        },
        {
            "key": "professional",
            "name": "Professional Style",
            "messages": [
                {"role": "system", "content": "You are a professional content strategist for {{brand}}."},
                {"role": "user", "content": "{{content_request}}"}
            ],
            "model": {
                "modelName": "gpt-4-turbo",
                "parameters": {
                    "temperature": 0.3,
                    "maxTokens": 3000,
                    "style_guide": "professional"
                }
            },
            "tools": [
                {"key": "search_knowledge_base", "version": 1},
                {"key": "get_customer_info", "version": 1}
            ]
        }
    ]

    # Add each variation
    url = f"https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-configs/{config_key}/variations"
    headers = {
        "Authorization": API_TOKEN,
        "Content-Type": "application/json",
        "LD-API-Version": "beta"
    }

    created_variations = []

    for variation in variations:
        response = requests.post(url, headers=headers, json=variation)

        if response.status_code in [200, 201]:
            print(f"  [OK] Added variation: {variation['key']}")
            created_variations.append(variation['key'])
            time.sleep(0.5)
        else:
            print(f"  [ERROR] Failed to add variation {variation['key']}: {response.text}")

    if created_variations:
        print(f"\n[OK] Added {len(created_variations)} variations to '{config_key}'")
        print(f"  URL: https://app.launchdarkly.com/projects/{PROJECT_KEY}/ai-configs/{config_key}")
        return True

    return False

# Execute
if __name__ == "__main__":
    add_completion_variations("content-assistant")
```

### Custom Parameters

Both examples above show how to add custom parameters in `model.parameters`. These parameters are passed directly to your application and can be used for any purpose:

- Framework-specific settings (LangGraph, CrewAI, Swarm, etc.)
- Application configuration
- Feature flags
- Runtime options

See the inline comments in the examples above for where to add custom parameters.

## Variation API Operations

### Get a Specific Variation

```python
def get_variation(config_key: str, variation_key: str):
    """Retrieve a specific variation by key."""
    url = f"https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-configs/{config_key}"
    headers = {"Authorization": API_TOKEN}
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        config = response.json()
        for variation in config.get('variations', []):
            if variation.get('key') == variation_key:
                print(f"[VARIATION] {variation['key']}")
                print(f"  Name: {variation.get('name', 'N/A')}")
                if 'instructions' in variation:
                    print(f"  Mode: Agent")
                elif 'messages' in variation:
                    print(f"  Mode: Completion ({len(variation['messages'])} messages)")
                if 'model' in variation:
                    print(f"  Model: {variation['model'].get('modelName', 'N/A')}")
                if 'tools' in variation and variation['tools']:
                    print(f"  Tools: {[t['key'] for t in variation['tools']]}")
                return variation
        print(f"[ERROR] Variation '{variation_key}' not found")
        return None
    else:
        print(f"[ERROR] Failed to get config: {response.text}")
        return None

get_variation("support-agent", "base-config")
```

### Update a Variation

```python
def update_variation(config_key: str, variation_key: str, updates: dict):
    """Update an existing variation. Only include fields that need updating."""
    url = f"https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-configs/{config_key}/variations/{variation_key}"

    payload = {}
    for field in ["name", "description", "instructions", "messages", "model", "tools"]:
        if field in updates:
            payload[field] = updates[field]

    headers = {"Authorization": API_TOKEN, "Content-Type": "application/json"}
    response = requests.patch(url, json=payload, headers=headers)

    if response.status_code == 200:
        print(f"[OK] Updated variation '{variation_key}'")
        return response.json()
    else:
        print(f"[ERROR] Failed to update variation: {response.text}")
        return None

updates = {
    "model": {
        "modelName": "gpt-4-turbo",
        "parameters": {"temperature": 0.6, "maxTokens": 3000}
    }
}
update_variation("support-agent", "base-config", updates)
```

### Delete a Variation

```python
def delete_variation(config_key: str, variation_key: str):
    """Delete a variation from an AI Config."""
    url = f"https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-configs/{config_key}/variations/{variation_key}"
    headers = {"Authorization": API_TOKEN}
    response = requests.delete(url, headers=headers)

    if response.status_code == 204:
        print(f"[OK] Deleted variation '{variation_key}'")
        return True
    else:
        print(f"[ERROR] Failed to delete variation: {response.text}")
        return False

delete_variation("support-agent", "deprecated-variation")
```

## Advanced Variation Management

### Clone a Variation

```python
def clone_variation(config_key: str, source_key: str, new_key: str, modifications: dict = None):
    """Clone an existing variation with optional modifications."""
    source = get_variation(config_key, source_key)
    if not source:
        return None

    new_variation = {
        "key": new_key,
        "name": modifications.get("name", f"Clone of {source.get('name', source_key)}") if modifications else f"Clone of {source.get('name', source_key)}",
    }

    # Copy fields from source, allow modifications to override
    for field in ["instructions", "messages", "model", "tools"]:
        if field in source:
            new_variation[field] = modifications.get(field, source[field]) if modifications else source[field]

    url = f"https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-configs/{config_key}/variations"
    headers = {"Authorization": API_TOKEN, "Content-Type": "application/json"}
    response = requests.post(url, headers=headers, json=new_variation)

    if response.status_code in [200, 201]:
        print(f"[OK] Cloned variation '{source_key}' to '{new_key}'")
        return response.json()
    else:
        print(f"[ERROR] Failed to clone variation: {response.text}")
        return None

clone_variation("support-agent", "base-config", "base-config-turbo", {
    "name": "Base Config - Turbo",
    "model": {"modelName": "gpt-4-turbo", "parameters": {"temperature": 0.6}}
})
```

### List All Variations

```python
def list_variations(config_key: str):
    """List all variations for an AI Config."""
    url = f"https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-configs/{config_key}"
    headers = {"Authorization": API_TOKEN}
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        config = response.json()
        variations = config.get('variations', [])
        print(f"[VARIATIONS] {len(variations)} variations in '{config_key}':\n")
        for v in variations:
            print(f"  - {v['key']}: {v.get('name', 'N/A')}")
        return variations
    else:
        print(f"[ERROR] Failed to list variations: {response.text}")
        return []

list_variations("support-agent")
```

## Best Practices

1. **Variation Keys**
   - Use semantic versioning (e.g., "agent-v1", "agent-v2")
   - Include model name for clarity (e.g., "gpt4-creative", "claude-accurate")
   - Keep keys lowercase with hyphens

2. **Testing Strategy**
   - Start with 2-3 variations maximum
   - Test one major change at a time
   - Use meaningful differences between variations

3. **Tool Management**
   - Always specify tool versions for stability
   - Test new tool versions in separate variations first
   - Document which tools each variation uses

4. **Judge Configuration**
   - Start with low sampling rates (10-20%)
   - Increase sampling for critical variations
   - Always include toxicity checking at 100%

5. **Custom Parameters**
   - Put all custom parameters in `model.parameters`
   - Document what each custom parameter does
   - Use consistent naming across variations

## Next Steps

After managing variations:
1. **Configure targeting** - See `aiconfig-targeting` to control who gets which variation
2. **Monitor metrics** - See `aiconfig-ai-metrics` to track usage and costs
3. **Set up Online Evals** - See `aiconfig-online-evals` for quality monitoring

## Related Skills

### Core Workflow
- `aiconfig-create` - Create AI Configs first
- `aiconfig-sdk` - Use variations in your application
- `aiconfig-targeting` - Target users to variations

### Testing & Optimization
- `aiconfig-experiments` - Run experiments with variations
- `aiconfig-ai-metrics` - Compare variation performance
- `aiconfig-online-evals` - Quality monitoring per variation

### Advanced Topics
- `aiconfig-frameworks` - Use variations with frameworks
- `aiconfig-tools` - Attach tools to variations
## References

- [AI Configs Overview](https://docs.launchdarkly.com/home/ai-configs)
- [AI Config Best Practices](https://docs.launchdarkly.com/tutorials/ai-configs-best-practices)
- [Python AI SDK](https://docs.launchdarkly.com/sdk/ai/python)