---
name: aiconfig-tools
description: Create, manage, and attach tools (functions) to LaunchDarkly AI Configs. Tools enable AI agents to interact with external systems, APIs, and databases.
compatibility: Requires LaunchDarkly API token with `/*:ai-tool/*` permission.
metadata:
  author: launchdarkly
  version: "0.1.0"
---

# AI Config Tools Management

Create and manage tools that enable AI agents to call functions, interact with external systems, and perform actions beyond text generation.

## Prerequisites

- LaunchDarkly API token with `/*:ai-tool/*` permission
- Project key
- Understanding of function calling in AI models

> **Note:** The LaunchDarkly MCP server does not currently have endpoints for managing AI tools (`/ai-tools`). Use the REST API below. See `aiconfig-api` for details on MCP limitations.

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

## What Are Tools?

Tools are function definitions that AI models can invoke to:
- Query databases
- Call external APIs
- Perform calculations
- Send notifications
- Execute business logic
- Interact with third-party services

Tools work in **BOTH agent and completion modes** via function calling.

## Tool Management API

**IMPORTANT - API Endpoint:**
```
Base URL: https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-tools
```

Do NOT use `/ai-configs/tools` - that endpoint does not exist. The correct path is `/ai-tools`.

> **Note on Orchestrator Integration**: Many AI orchestrators (like LangGraph, CrewAI, AutoGen) automatically create their own tool schemas from function definitions. When using these frameworks, you often don't need to manually define JSON schemas - the orchestrator will generate them based on your tool's function signature and docstring. However, you still need to attach the tool names/keys to your AI Config variations so the SDK knows which tools are available for each variation.

### Create a New Tool

```python
import requests
import os

API_TOKEN = os.environ.get("LAUNCHDARKLY_API_TOKEN")
PROJECT_KEY = "support-ai"

def create_tool(tool_key: str, schema: dict, description: str = None):
    """Create a new tool in LaunchDarkly."""
    url = f"https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-tools"
    payload = {
        "key": tool_key,
        "schema": schema,
        "description": description or f"Tool: {tool_key}"
    }
    headers = {
        "Authorization": API_TOKEN,
        "Content-Type": "application/json"
    }

    response = requests.post(url, json=payload, headers=headers)

    if response.status_code == 201:
        return response.json()
    elif response.status_code == 409:
        return get_tool(tool_key)
    else:
        return None

# Example: Create a search tool (plain JSON Schema format)
search_schema = {
    "type": "object",
    "properties": {
        "query": {"type": "string", "description": "Search query"},
        "limit": {"type": "integer", "default": 5}
    },
    "required": ["query"]
}

create_tool("search_knowledge_base", search_schema, "Search internal documentation")
```

### Get a Specific Tool

```python
def get_tool(tool_key: str):
    """Retrieve a specific tool by key."""
    url = f"https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-tools/{tool_key}"
    headers = {"Authorization": API_TOKEN}
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        tool = response.json()
        print(f"[TOOL] {tool['key']}")
        print(f"  Description: {tool.get('description', 'N/A')}")
        print(f"  Version: {tool.get('version', 1)}")
        print(f"  Schema: {tool.get('schema', {})}")
        return tool
    else:
        print(f"[ERROR] Tool not found: {response.text}")
        return None

get_tool("search_knowledge_base")
```

### List All Tools

```python
def list_all_tools():
    """List all tools available in the project."""
    url = f"https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-tools"
    headers = {"Authorization": API_TOKEN}
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        tools = response.json().get('items', [])
        print(f"[TOOLS] {len(tools)} tools in project '{PROJECT_KEY}':\n")
        for tool in tools:
            print(f"  - {tool['key']} (v{tool.get('version', 1)}): {tool.get('description', 'N/A')}")
        return tools
    else:
        print(f"[ERROR] Failed to list tools: {response.text}")
        return []

list_all_tools()
```

### Update a Tool

```python
def update_tool(tool_key: str, updates: dict):
    """Update an existing tool's description or schema."""
    url = f"https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-tools/{tool_key}"

    payload = {}
    if "description" in updates:
        payload["description"] = updates["description"]
    if "schema" in updates:
        payload["schema"] = updates["schema"]

    headers = {
        "Authorization": API_TOKEN,
        "Content-Type": "application/json"
    }

    response = requests.patch(url, json=payload, headers=headers)

    if response.status_code == 200:
        print(f"[OK] Updated tool: {tool_key}")
        return response.json()
    else:
        print(f"[ERROR] Failed to update: {response.text}")
        return None

updates = {
    "description": "Enhanced search with semantic capabilities",
    "schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query"},
            "semantic": {"type": "boolean", "description": "Use semantic search", "default": True},
            "limit": {"type": "integer", "description": "Maximum results", "default": 5}
        },
        "required": ["query"]
    }
}

update_tool("search_knowledge_base", updates)
```

### Delete a Tool

```python
def delete_tool(tool_key: str):
    """Delete a tool. Warning: removes from all configs using it."""
    url = f"https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-tools/{tool_key}"
    headers = {"Authorization": API_TOKEN, "Content-Type": "application/json"}
    response = requests.delete(url, headers=headers)

    if response.status_code == 204:
        print(f"[OK] Deleted tool: {tool_key}")
        return True
    else:
        print(f"[ERROR] Failed to delete: {response.text}")
        return False

delete_tool("deprecated_tool")
```

### Get Tool Versions

```python
def get_tool_versions(tool_key: str):
    """Get all versions of a tool."""
    url = f"https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-tools/{tool_key}/versions"
    headers = {"Authorization": API_TOKEN}
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        versions = response.json().get('items', [])
        print(f"[VERSIONS] {len(versions)} version(s) for '{tool_key}':\n")
        for v in versions:
            print(f"  - Version {v['version']} (created: {v.get('createdAt', 'N/A')})")
        return versions
    else:
        print(f"[ERROR] Failed to get versions: {response.text}")
        return []

get_tool_versions("search_knowledge_base")
```

## Attaching Tools to AI Config Variations

After creating tools, attach them to AI Config variations to enable function calling:

### Add Tools to a Variation

```python
def attach_tools_to_variation(config_key: str, variation_id: str, tool_keys: list):
    """
    Attach tools to a specific variation of an AI Config.
    Tools must be created first using create_tool().
    """

    # First, get the config to find the variation
    url = f"https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-configs/{config_key}"

    headers = {
        "Authorization": API_TOKEN,
        "Content-Type": "application/json"
    }

    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print(f"[ERROR] Failed to get config: {response.text}")
        return None

    config = response.json()

    # Find and update the variation
    variations = config.get('variations', [])
    variation_found = False

    for variation in variations:
        if variation.get('_id') == variation_id or variation.get('key') == variation_id:
            # Format tools for the variation
            variation['tools'] = [
                {"key": tool_key, "version": 1}
                for tool_key in tool_keys
            ]
            variation_found = True
            break

    if not variation_found:
        print(f"[ERROR] Variation '{variation_id}' not found")
        return None

    # Update the config with modified variations
    update_payload = {
        "variations": variations
    }

    response = requests.patch(url, json=update_payload, headers=headers)

    if response.status_code == 200:
        print(f"[OK] Attached {len(tool_keys)} tools to variation '{variation_id}'")
        return response.json()
    else:
        print(f"[ERROR] Failed to attach tools: {response.text}")
        return None

# Example: Attach tools to a variation
tools_to_attach = [
    "search_knowledge_base",
    "create_ticket",
    "send_email"
]

attach_tools_to_variation("support-agent", "base-config", tools_to_attach)
```

### Update Tools in Variation

```python
def update_variation_tools(config_key: str, variation_id: str, tool_updates: list):
    """
    Update tool configuration in a variation.
    This updates which tools are attached, not the tool definitions.
    """

    url = f"https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-configs/{config_key}"

    headers = {
        "Authorization": API_TOKEN,
        "Content-Type": "application/json"
    }

    # Get current config
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        return None

    config = response.json()
    variations = config.get('variations', [])

    # Update the specific variation
    for variation in variations:
        if variation.get('_id') == variation_id or variation.get('key') == variation_id:
            # Update tools with version control
            variation['tools'] = tool_updates
            break

    # Apply update
    update_payload = {
        "variations": variations
    }

    response = requests.patch(url, json=update_payload, headers=headers)

    if response.status_code == 200:
        print(f"[OK] Updated tools in variation '{variation_id}'")
        return response.json()
    else:
        print(f"[ERROR] Failed to update tools: {response.text}")
        return None

# Example: Update with specific versions
tool_updates = [
    {"key": "search_knowledge_base", "version": 2},  # Use version 2
    {"key": "create_ticket", "version": 1},
    {"key": "analyze_sentiment", "version": 1}  # Add new tool
]

update_variation_tools("support-agent", "base-config", tool_updates)
```

## Common Tool Schemas

### Database Query Tool

```python
database_tool = {
    "key": "query_database",
    "schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "SQL query to execute"
            },
            "database": {
                "type": "string",
                "enum": ["customers", "orders", "products"],
                "description": "Target database"
            },
            "limit": {
                "type": "integer",
                "description": "Max rows to return",
                "default": 100
            }
        },
        "required": ["query", "database"]
    },
    "description": "Query internal databases"
}

create_tool(database_tool["key"], database_tool["schema"], database_tool["description"])
```

### API Integration Tool

```python
api_tool = {
    "key": "call_external_api",
    "schema": {
        "type": "object",
        "properties": {
            "endpoint": {
                "type": "string",
                "description": "API endpoint path"
            },
            "method": {
                "type": "string",
                "enum": ["GET", "POST", "PUT", "DELETE"],
                "default": "GET"
            },
            "payload": {
                "type": "object",
                "description": "Request payload for POST/PUT"
            },
            "headers": {
                "type": "object",
                "description": "Additional headers"
            }
        },
        "required": ["endpoint"]
    },
    "description": "Make external API calls"
}

create_tool(api_tool["key"], api_tool["schema"], api_tool["description"])
```

### Notification Tool

```python
notification_tool = {
    "key": "send_notification",
    "schema": {
        "type": "object",
        "properties": {
            "channel": {
                "type": "string",
                "enum": ["email", "slack", "sms", "webhook"],
                "description": "Notification channel"
            },
            "recipient": {
                "type": "string",
                "description": "Recipient identifier"
            },
            "subject": {
                "type": "string",
                "description": "Notification subject"
            },
            "message": {
                "type": "string",
                "description": "Notification body"
            },
            "priority": {
                "type": "string",
                "enum": ["low", "normal", "high", "urgent"],
                "default": "normal"
            }
        },
        "required": ["channel", "recipient", "message"]
    },
    "description": "Send multi-channel notifications"
}

create_tool(notification_tool["key"], notification_tool["schema"], notification_tool["description"])
```

## Tool Sets for Common Use Cases

```python
def create_customer_support_tools():
    """Create a complete tool set for customer support agents"""

    tools = [
        {
            "key": "lookup_customer",
            "description": "Look up customer information",
            "schema": {
                "type": "object",
                "properties": {
                    "identifier": {
                        "type": "string",
                        "description": "Customer ID or email"
                    }
                },
                "required": ["identifier"]
            }
        },
        {
            "key": "check_order_status",
            "description": "Check order status",
            "schema": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "Order ID"
                    }
                },
                "required": ["order_id"]
            }
        },
        {
            "key": "create_support_ticket",
            "description": "Create a support ticket",
            "schema": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Ticket title"
                    },
                    "description": {
                        "type": "string",
                        "description": "Issue description"
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["low", "medium", "high", "urgent"],
                        "default": "medium"
                    },
                    "customer_id": {
                        "type": "string",
                        "description": "Customer ID"
                    }
                },
                "required": ["title", "description", "customer_id"]
            }
        }
    ]

    # Create all tools
    created_tools = []
    for tool in tools:
        result = create_tool(
            tool["key"],
            tool["schema"],
            tool["description"]
        )
        if result:
            created_tools.append(tool["key"])

    print(f"\n[OK] Created {len(created_tools)} customer support tools")
    return created_tools

# Create the tool set
support_tools = create_customer_support_tools()

# Then attach to your support agent config
attach_tools_to_variation("support-agent", "production", support_tools)
```

## Mapping Tool Definitions to Handlers

When using tools from LaunchDarkly, you need to map the tool definitions to your local handler functions:

```python
from typing import Dict, Callable, Any

# Define your local tool handler functions
async def search_knowledge_base(query: str, limit: int = 5) -> str:
    """Search internal documentation."""
    # Your implementation here
    return f"Found {limit} results for: {query}"

async def get_customer_info(identifier: str) -> str:
    """Look up customer information."""
    # Your implementation here
    return f"Customer info for: {identifier}"

async def create_ticket(title: str, description: str, customer_id: str) -> str:
    """Create a support ticket."""
    # Your implementation here
    return f"Created ticket: {title}"

# Map tool keys to handler functions
tool_handlers: Dict[str, Callable] = {
    "search_knowledge_base": search_knowledge_base,
    "get_customer_info": get_customer_info,
    "create_support_ticket": create_ticket,
}

def get_tools_with_handlers(config):
    """Get tools from config and map to local handlers."""
    tools_with_handlers = []

    for tool_ref in config.tools or []:
        tool_name = tool_ref.name  # or tool_ref.key depending on SDK version
        if tool_name in tool_handlers:
            tools_with_handlers.append({
                "name": tool_name,
                "handler": tool_handlers[tool_name],
                "schema": tool_ref.schema  # Schema from LaunchDarkly
            })
        else:
            print(f"[WARNING] No handler for tool: {tool_name}")

    return tools_with_handlers

# Usage with AI Config
context = build_context("user-123")
config = ai_client.agent_config("support-agent", context, fallback, {})

if config.enabled:
    tools = get_tools_with_handlers(config)
    # Pass tools to your AI orchestrator or handle function calls manually
```

## Best Practices

1. **Create Tools Before Configs**
   - Tools must exist before being attached to variations
   - Use consistent naming conventions (snake_case)

2. **Version Management**
   - Tools are versioned automatically
   - Specify version when attaching to variations for stability

3. **Schema Design**
   - Use clear, descriptive parameter names
   - Provide good descriptions for AI model understanding
   - Mark only essential parameters as required

4. **Security**
   - Never include credentials in tool schemas
   - Tools should validate inputs
   - Use appropriate access controls

5. **Testing**
   - Test tools individually before attaching to configs
   - Use variations to test different tool combinations

## Next Steps

After creating and attaching tools:
1. **Implement tool handlers** - See `aiconfig-sdk` for execution
2. **Create AI Configs** - See `aiconfig-create` to create configs that use your tools
3. **Test variations** - See `aiconfig-variations` to test different tool combinations
4. **Monitor usage** - See `aiconfig-ai-metrics` to track tool performance

## Related Skills

### Core Workflow
- `aiconfig-create` - Attach tools to AI Configs
- `aiconfig-variations` - Tools per variation
- `aiconfig-sdk` - Use tools in your application

### Frameworks
- `aiconfig-frameworks` - Tools with orchestrators
- `aiconfig-experiments` - Test tool effectiveness
- `aiconfig-ai-metrics` - Track tool usage
## References

- [LaunchDarkly AI Tools API](https://docs.launchdarkly.com/home/ai-configs/tools)
- [Function Calling in AI](https://platform.openai.com/docs/guides/function-calling)
- [Python AI SDK](https://docs.launchdarkly.com/sdk/ai/python)