---
name: aiconfig-create
description: Create a new LaunchDarkly AI Config with variations, model configurations, and targeting. Use this skill to programmatically create AI Configs for agent or completion mode.
compatibility: Requires LaunchDarkly API access token with ai-configs:write permission.
metadata:
  author: launchdarkly
  version: "0.1.0"
---

# Create AI Config

Create a new AI Config in LaunchDarkly using the API, enabling dynamic configuration of AI models, prompts, and parameters without code changes.

## Prerequisites

- LaunchDarkly account with AI Configs enabled
- API access token with `ai-configs:write` permission
- Project key (create one using the `aiconfig-projects` skill if needed)

> **Note:** The LaunchDarkly MCP server has `create-ai-config` and `create-ai-config-variation` tools, but they cannot configure tools, model parameters, or custom parameters. Use the REST API below for full functionality. See `aiconfig-api` for details.

## API Key Detection

Before prompting the user for an API key, try to detect it automatically:

1. **Check Claude MCP config** - Read `~/.claude/config.json` and look for `mcpServers.launchdarkly.env.LAUNCHDARKLY_API_KEY`
2. **Check environment variables** - Look for `LAUNCHDARKLY_API_KEY`, `LAUNCHDARKLY_API_TOKEN`, or `LD_API_KEY`
3. **Prompt user** - Only if detection fails, ask the user for their API key

```python
import os
import json
from pathlib import Path

def get_launchdarkly_api_key():
    """Auto-detect LaunchDarkly API key from Claude config or environment."""
    # 1. Check Claude MCP config
    claude_config = Path.home() / ".claude" / "config.json"
    if claude_config.exists():
        try:
            config = json.load(open(claude_config))
            api_key = config.get("mcpServers", {}).get("launchdarkly", {}).get("env", {}).get("LAUNCHDARKLY_API_KEY")
            if api_key:
                return api_key
        except (json.JSONDecodeError, IOError):
            pass

    # 2. Check environment variables
    for var in ["LAUNCHDARKLY_API_KEY", "LAUNCHDARKLY_API_TOKEN", "LD_API_KEY"]:
        if os.environ.get(var):
            return os.environ[var]

    return None
```

## Agent Mode vs Completion Mode

### Understanding the Difference

LaunchDarkly AI Configs support two distinct modes:

#### 1. **Agent Mode** (For Orchestration)
- **Purpose**: Complex, multi-step AI workflows with persistent instructions
- **Use When**: Building agents that need consistent behavior across interactions
- **Config Contains**: Instructions (string) for agent behavior
- **Tools**: Supported via model.parameters.tools
- **Best For**: LangGraph, CrewAI, Swarm, AutoGen orchestration
- **Example Use Cases**:
  - Customer support agents with consistent personality
  - Data analysis workflows with specific methodologies
  - Multi-step reasoning tasks
  - Agent handoff scenarios

#### 2. **Completion Mode** (For Direct LLM Calls)
- **Purpose**: Direct LLM API calls with full message control
- **Use When**: You need to control the exact message structure
- **Config Contains**: Messages array (system, user, assistant)
- **Tools**: Supported via model.parameters.tools (function calling)
- **Best For**: OpenAI Chat API, Anthropic Messages API, function calling
- **Example Use Cases**:
  - Content generation with tools
  - Q&A with function calling
  - Text analysis with external tool access
  - Translation with terminology lookups

### Decision Tree

```
Need persistent agent instructions across interactions?
├─ YES → Use Agent Mode
│   └─ Config provides: instructions string, tools, params
│
└─ NO → Need direct message control?
    └─ YES → Use Completion Mode
        └─ Config provides: messages array, tools, params
```

### Key Difference
- **Agent Mode**: Instructions are a single string that persists
- **Completion Mode**: Messages array gives you full control
- **Both modes support tools in model.parameters.tools!**

## Workflow

### Step 1: Choose Your Mode

```python
# Agent Mode Example
agent_config = {
    "configType": "agent",
    "agentConfig": {
        "instructions": "You are a helpful agent. Use tools when needed.",
        # Instructions are a single string
    }
}

# Completion Mode Example
completion_config = {
    "configType": "completion",
    "messages": [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "{{user_input}}"}
        # Messages are an array
    ]
}
```

### Step 2: Gather AI Config Details

1. **Get configuration from user:**
   - Key (required) — unique identifier (lowercase, hyphens)
   - Name (required) — human-readable display name
   - Mode — `agent` or `completion` (choose based on use case above)
   - Description (optional)
   - Tags (optional) — for organization

2. **Clarify variation requirements:**
   - Number of variations to create
   - Model selection for each variation
   - Parameters (temperature, max_tokens, etc.)
   - Instructions (agent mode) or messages (completion mode)
   - Tools needed (must be created before attaching to variations)

3. **Check for existing config:**
   - Verify the key doesn't already exist
   - If it exists, ask user if they want to update it instead

### Step 3: Prepare Configuration

Based on mode, prepare the appropriate structure:

**For Agent Mode:**
- Instructions for the agent (single string)
- Model configuration
- Tools list (must be created first - see `aiconfig-tools` skill)
- Template variables using `{{variable}}`
- Custom parameters for your application

**For Completion Mode:**
- System/user/assistant messages array
- Model configuration
- Tools list for function calling (must be created first)
- Template variables using `{{variable}}`
- Custom parameters for your application

**Important: Tools Setup**
- Tools must be created BEFORE they can be attached to variations
- **API endpoint for tools:** `POST https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-tools`
- Do NOT use `/ai-configs/tools` - that endpoint does not exist

**⚠️ Tools cannot be attached via defaultVariation** - they are ignored during config creation. You must:
1. Create the AI Config first (without tools)
2. Then PATCH the variation to attach tools:
   ```
   PATCH /api/v2/projects/{PROJECT_KEY}/ai-configs/{CONFIG_KEY}/variations/{VARIATION_KEY}
   {"tools": [{"key": "tool-name", "version": 1}]}
   ```
- See `aiconfig-tools` skill for the complete workflow

### Step 4: Create via API

Use the LaunchDarkly REST API to create the config:

```python
import requests
import json

def create_aiconfig(api_token, project_key, config_data):
    """Create an AI Config using the LaunchDarkly API"""

    url = f"https://app.launchdarkly.com/api/v2/projects/{project_key}/ai-configs"

    headers = {
        "Authorization": api_token,
        "Content-Type": "application/json"
    }

    response = requests.post(url, headers=headers, json=config_data)

    if response.status_code == 201:
        return response.json()
    else:
        raise Exception(f"Failed to create AI Config: {response.text}")
```

### Step 5: Verify Creation

**IMPORTANT:** Always verify the config was created correctly with all properties.

1. **Fetch the created config via API to verify:**
```python
def verify_config(api_token, project_key, config_key):
    """Verify AI Config was created with correct properties."""
    url = f"https://app.launchdarkly.com/api/v2/projects/{project_key}/ai-configs/{config_key}"
    headers = {"Authorization": api_token}

    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        config = response.json()
        print(f"[OK] Config: {config['key']}")
        print(f"     Mode: {config['mode']}")
        print(f"     Variations: {len(config.get('variations', []))}")
        for v in config.get('variations', []):
            model = v.get('model', {})
            tools = v.get('tools', [])
            print(f"     - {v['key']}: {model.get('modelName', 'NO MODEL')} ({len(tools)} tools)")
            if model.get('parameters'):
                print(f"       Parameters: {model['parameters']}")
            else:
                print(f"       [WARNING] No parameters set!")
        return config
    return None
```

2. **Check for missing model/parameters** - If a variation shows no model or parameters:
```python
def fix_variation_model(api_token, project_key, config_key, variation_key, model_config):
    """Fix missing model configuration on a variation."""
    url = f"https://app.launchdarkly.com/api/v2/projects/{project_key}/ai-configs/{config_key}/variations/{variation_key}"
    headers = {"Authorization": api_token, "Content-Type": "application/json"}

    response = requests.patch(url, headers=headers, json={"model": model_config})
    return response.status_code == 200
```

3. **ALWAYS provide the config URL to the user:**
   ```
   https://app.launchdarkly.com/projects/{PROJECT_KEY}/ai-configs/{CONFIG_KEY}
   ```

4. **Suggest next steps** (targeting, experimentation, SDK integration)

## Model Configuration

### List Available Models

Fetch available model configs from the API:

```bash
GET https://app.launchdarkly.com/api/v2/projects/{projectKey}/ai-configs/model-configs
```

Response includes `key` (use as `modelConfigKey`), `provider`, `name`, and pricing info.

### modelConfigKey (Required)

**`modelConfigKey` is required for models to display correctly in the UI.** The format is `{Provider}.{model-id}`:

| Provider | Model ID | modelConfigKey |
|----------|----------|----------------|
| OpenAI | gpt-4o | `OpenAI.gpt-4o` |
| OpenAI | gpt-4o-mini | `OpenAI.gpt-4o-mini` |
| Anthropic | claude-sonnet-4-5 | `Anthropic.claude-sonnet-4-5` |
| Anthropic | claude-3-5-sonnet | `Anthropic.claude-3-5-sonnet` |
| Bedrock | anthropic.claude-3-5-sonnet | `Bedrock.anthropic.claude-3-5-sonnet` |

## Python Examples

### Example 1: Complete Agent Mode Config (Two-Step)

Creates an AI Config first, then adds a variation with proper model configuration.

```python
import requests
import os
import time

# Configuration
API_TOKEN = os.environ.get("LAUNCHDARKLY_API_TOKEN")
PROJECT_KEY = "support-ai"

def create_agent_config():
    """Create an AI Config for agent mode using two-step process."""
    config_key = "support-agent"

    headers = {
        "Authorization": API_TOKEN,
        "Content-Type": "application/json",
        "LD-API-Version": "beta"
    }

    # Step 1: Create AI Config (without defaultVariation for reliable model config)
    config_data = {
        "key": config_key,
        "name": "Customer Support Agent",
        "mode": "agent",
        "provider": {"name": "openai"},  # Provider at config level
        "modelName": "gpt-4o"             # Model at config level
    }

    url = f"https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-configs"
    response = requests.post(url, headers=headers, json=config_data)

    if response.status_code not in [200, 201]:
        print(f"[ERROR] Failed to create config: {response.text}")
        return None

    print(f"[OK] Created AI Config: {config_key}")
    time.sleep(0.5)

    # Step 2: Create variation with model configuration
    # modelConfigKey is the key field that makes the model show in UI
    variation_data = {
        "key": "default",
        "name": "Default Configuration",
        "instructions": """You are a helpful customer support agent.

Your responsibilities:
- Answer customer questions
- Resolve issues efficiently
- Maintain a friendly tone

Company: {{company_name}}
Priority: {{support_priority}}""",
        "modelConfigKey": "OpenAI.gpt-4o",  # Format: {Provider}.{model-id}
        "model": {
            "modelName": "gpt-4o",
            "parameters": {"temperature": 0.7, "maxTokens": 2000}
        }
    }

    var_url = f"https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-configs/{config_key}/variations"
    var_response = requests.post(var_url, headers=headers, json=variation_data)

    if var_response.status_code not in [200, 201]:
        print(f"[ERROR] Failed to create variation: {var_response.text}")
        return None

    print(f"[OK] Created variation 'default' with model gpt-4o")
    print(f"  URL: https://app.launchdarkly.com/projects/{PROJECT_KEY}/ai-configs/{config_key}")
    return var_response.json()

# Execute
if __name__ == "__main__":
    create_agent_config()
```

### Example 2: Multiple Variations with Different Models

Creates an AI Config with multiple variations using different models.

```python
def create_multi_variation_config():
    """Create an AI Config with multiple variations for A/B testing."""
    config_key = "content-assistant"

    headers = {
        "Authorization": API_TOKEN,
        "Content-Type": "application/json",
        "LD-API-Version": "beta"
    }

    # Step 1: Create AI Config
    config_data = {
        "key": config_key,
        "name": "Content Generation Assistant",
        "mode": "completion",
        "provider": {"name": "openai"},
        "modelName": "gpt-4o"
    }

    url = f"https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-configs"
    response = requests.post(url, headers=headers, json=config_data)

    if response.status_code not in [200, 201]:
        print(f"[ERROR] Failed to create config: {response.text}")
        return None

    print(f"[OK] Created AI Config: {config_key}")
    time.sleep(0.5)

    # Step 2: Create variations with different models
    # modelConfigKey is the key field for model selection
    variations = [
        {
            "key": "standard",
            "name": "Standard (GPT-4o-mini)",
            "messages": [
                {"role": "system", "content": "You are a helpful content writer."},
                {"role": "user", "content": "{{content_request}}"}
            ],
            "modelConfigKey": "OpenAI.gpt-4o-mini",
            "model": {
                "modelName": "gpt-4o-mini",
                "parameters": {"temperature": 0.7, "maxTokens": 1000}
            }
        },
        {
            "key": "premium",
            "name": "Premium (GPT-4o)",
            "messages": [
                {"role": "system", "content": "You are a creative content expert."},
                {"role": "user", "content": "{{content_request}}"}
            ],
            "modelConfigKey": "OpenAI.gpt-4o",
            "model": {
                "modelName": "gpt-4o",
                "parameters": {"temperature": 0.8, "maxTokens": 2000}
            }
        }
    ]

    var_url = f"https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-configs/{config_key}/variations"

    for var in variations:
        var_response = requests.post(var_url, headers=headers, json=var)
        if var_response.status_code in [200, 201]:
            print(f"[OK] Created variation '{var['key']}' with {var['model']['modelName']}")
        else:
            print(f"[ERROR] Failed to create variation '{var['key']}': {var_response.text}")
        time.sleep(0.5)

    print(f"  URL: https://app.launchdarkly.com/projects/{PROJECT_KEY}/ai-configs/{config_key}")

# Execute
if __name__ == "__main__":
    create_multi_variation_config()
```

### Custom Parameters

Both examples above show how to add custom parameters in `model.parameters`. These parameters are passed directly to your application and can be used for any purpose:

- Framework-specific settings (LangGraph, CrewAI, Swarm, etc.)
- Application configuration
- Feature flags
- Runtime options

See the inline comments in the examples above for where to add custom parameters. For framework-specific examples, refer to the orchestration skills listed in the Related Skills section.

## Additional Configuration

After creating your AI Config, you may want to:

- **Configure targeting rules** - See the `aiconfig-targeting` skill for controlling who receives which variation
- **Add more variations** - See the `aiconfig-variations` skill
- **Attach tools** - See the `aiconfig-tools` skill
- **Add online evaluations** - See the `aiconfig-online-evals` skill to attach judges for quality monitoring
- **Track metrics** - See the `aiconfig-ai-metrics` skill for performance tracking

## Edge Cases

### Config Already Exists
**Response:** "An AI Config with key `support-agent` already exists. Would you like to update it instead?"

### Invalid Model ID
**Response:** "The model ID `invalid-model` is not recognized. Please use a valid model identifier."

### Missing Permissions
**Response:** "Your API token lacks `ai-configs:write` permission. Please update your token permissions."

### Invalid Key Format
**Response:** "Config keys must be lowercase with hyphens only. Suggested: `my-config-key`"

## Best Practices

1. **Naming Conventions**
   - Use descriptive, kebab-case keys
   - Keep names concise but meaningful
   - Include environment in key if needed (e.g., `support-agent-prod`)

2. **Variation Design**
   - Start with 2-3 variations for experimentation
   - Use conservative parameters initially
   - Document the purpose of each variation

3. **Model Selection**
   - Consider cost vs. performance tradeoffs
   - Match model capabilities to task complexity
   - Set appropriate token limits

4. **Template Variables**
   - Use `{{variables}}` for dynamic content
   - Document all variables used
   - Provide defaults where possible

## API Response

### Success Response (201 Created)
```json
{
  "key": "support-agent",
  "name": "Customer Support Agent",
  "version": 1,
  "creationDate": 1704067200000,
  "variations": [...],
  "_links": {
    "self": {
      "href": "/api/v2/projects/default/ai-configs/support-agent"
    }
  }
}
```

### Error Responses
- **400 Bad Request**: Invalid request body
- **401 Unauthorized**: Invalid or missing API token
- **403 Forbidden**: Insufficient permissions
- **409 Conflict**: Config with this key already exists

## Next Steps

After creating an AI Config:
1. **Verify creation** - Check the LaunchDarkly UI or use the API to confirm
2. **Set up monitoring** - Use `aiconfig-ai-metrics` skill to track performance and usage
3. **Configure targeting** - Use `aiconfig-targeting` skill to control rollout

## Related Skills

### Core Workflow
- `aiconfig-projects` - Create and manage projects to organize AI Configs
- `aiconfig-sdk` - Integrate AI Configs with your application
- `aiconfig-targeting` - Configure targeting rules for controlled rollout

### Configuration Management
- `aiconfig-variations` - Manage and test multiple variations
- `aiconfig-tools` - Create and manage tools for function calling
- `aiconfig-experiments` - Run experiments to compare performance

### Monitoring & Quality
- `aiconfig-ai-metrics` - Track automatic AI metrics (tokens, latency, cost)
- `aiconfig-custom-metrics` - Track custom business metrics
- `aiconfig-online-evals` - Add quality monitoring with judges

### Advanced Topics
- `aiconfig-context-basic` - Basic context patterns for targeting
- `aiconfig-context-advanced` - Advanced multi-context patterns
- `aiconfig-frameworks` - Integration with LangGraph, CrewAI, and other frameworks

### API Reference
- `aiconfig-api` - Complete API reference for managing AI Configs

## References

- [LaunchDarkly AI Configs Documentation](https://docs.launchdarkly.com/home/ai-configs)
- [AI Configs Quickstart](https://docs.launchdarkly.com/home/ai-configs/quickstart)
- [AI Config Best Practices Tutorial](https://docs.launchdarkly.com/tutorials/ai-configs-best-practices)
- [Python AI SDK](https://docs.launchdarkly.com/sdk/ai/python)