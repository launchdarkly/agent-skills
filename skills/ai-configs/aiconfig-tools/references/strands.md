# Strands Tools

Strands ([strandsagents.com](https://strandsagents.com)) wires tools through the `Agent(tools=[...])` constructor from application code; LaunchDarkly governs the tool list (schema, version, attachment per variation). Detaching a tool from a variation in the LaunchDarkly UI takes effect on the next agent invocation, with no code change.

## Pattern: LD-driven tool list + local handlers

1. **Register tool schema in LD** — `POST /projects/{project}/ai-tools` (see [API Quick Start](api-quickstart.md))
2. **Attach to variation** — `PATCH /ai-configs/{config}/variations/{variation}` with `{"tools": [{"key": "...", "version": 1}]}`
3. **Define handler in app code** — Strands `@tool`-decorated Python function
4. **Resolve at runtime** — match LD-attached tool names against a local `TOOL_REGISTRY`

```python
from strands import tool

# Module-level reference reassigned per invocation so @tool body can fire
# track_tool_call on the right tracker (SDK 0.18+ is at-most-once per tracker).
_tracker = None

@tool
def get_order_status(order_id: str) -> str:
    """Look up the status of a customer order by order ID."""
    if _tracker is not None:
        _tracker.track_tool_call("get_order_status")
    orders = {"ORD-123": "Shipped", "ORD-456": "Processing"}
    return orders.get(order_id, f"No order found with ID {order_id}")

# Map LD tool *key* -> local Strands tool object.
TOOL_REGISTRY = {"get_order_status": get_order_status}
```

## Resolve at runtime

Read the attached tools from the variation and look them up in `TOOL_REGISTRY`:

```python
config = ai_client.agent_config("strands-agent", context)
ld_tool_params = (config.model.to_dict().get("parameters") or {}).get("tools") or []
tool_names = [t["name"] for t in ld_tool_params]
resolved_tools = [TOOL_REGISTRY[n] for n in tool_names if n in TOOL_REGISTRY]
missing = [n for n in tool_names if n not in TOOL_REGISTRY]
if missing:
    print(f"[WARN] LD attached tools {missing} have no local handler")

agent = Agent(model=..., system_prompt=config.instructions, tools=resolved_tools, ...)
```

The list is recomputed per agent build, so detaching a tool in LD propagates within the SDK's streaming window (~1s).

## Per-invocation tool-call tracking

The `@tool` body fires `_tracker.track_tool_call(name)`. The dispatcher publishes a fresh tracker to the module global before each invocation:

```python
global _tracker
_tracker = config.create_tracker()
result = await _tracker.track_metrics_of_async(
    strands_metrics_extractor,                 # see aiconfig-create/references/strands.md
    lambda: agent.invoke_async(user_input),
)
```

Don't pass `tool_calls=` in the `LDAIMetrics` extractor — that would double-count against the per-call `track_tool_call` already firing from the `@tool` body.

## Schema format

LaunchDarkly stores tool schemas in OpenAI function-calling format. For Strands, the schema lives in LD; the Python handler signature (`def get_order_status(order_id: str) -> str:`) is what Strands actually invokes. Keep the parameter names and types in sync between the LD schema and the Python function or the LLM's tool call will fail validation.

## Reference implementation

Full pattern (governed tool + Strands handler + per-invocation tracking) is in the sample at [strands-agents/samples/python/03-integrate/runtime-control/launchdarkly](https://github.com/strands-agents/samples/tree/main/python/03-integrate/runtime-control/launchdarkly).
