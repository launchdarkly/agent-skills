---
name: aiconfig-targeting
description: Configure LaunchDarkly AI Config targeting rules via API to control which users receive specific variations. Enable A/B tests, percentage splits, segment targeting, and multi-context rules.
compatibility: Requires LaunchDarkly API access token with write permissions.
metadata:
  author: launchdarkly
  version: "0.2.0"
---

# AI Config Targeting

Configure targeting rules for AI Configs programmatically via API to control which variations are served to different contexts, enabling A/B testing, percentage-based traffic splits, and sophisticated user segmentation.

## Prerequisites

- LaunchDarkly account with AI Configs enabled
- API access token with write permissions
- Project key and environment key
- Existing AI Config with variations
- Understanding of contexts (see `aiconfig-context-basic`)

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

## Core Concepts

### Targeting Evaluation Order

AI Configs evaluate targeting rules in this priority order:
1. **Individual targets** - Specific context keys (highest priority)
2. **Segment rules** - Pre-defined segments
3. **Custom rules** - Attribute-based conditions (evaluated in order)
4. **Default rule** - Fallthrough for all others

### API Approach

AI Config targeting uses a dedicated endpoint with semantic patch instructions:
```
GET /api/v2/projects/{projectKey}/ai-configs/{configKey}/targeting
PATCH /api/v2/projects/{projectKey}/ai-configs/{configKey}/targeting
```

Headers required:
- `Authorization: {API_TOKEN}`
- `Content-Type: application/json; domain-model=launchdarkly.semanticpatch`

> **Important:** The targeting API uses `variationId` (UUID) not variation keys. You must look up variation IDs from the targeting response before creating rules.

## Python Implementation

### Setup and Configuration

```python
import requests
import json
import os
from typing import Dict, List, Optional

class AIConfigTargeting:
    """Manager for AI Config targeting rules"""

    def __init__(self, api_token: str, project_key: str):
        self.api_token = api_token
        self.project_key = project_key
        self.base_url = "https://app.launchdarkly.com/api/v2"
        self.headers = {
            "Authorization": api_token,
            "Content-Type": "application/json; domain-model=launchdarkly.semanticpatch"
        }

    def get_targeting(self, config_key: str) -> Optional[Dict]:
        """Get current targeting configuration including variation IDs"""
        url = f"{self.base_url}/projects/{self.project_key}/ai-configs/{config_key}/targeting"

        response = requests.get(url, headers={"Authorization": self.api_token})

        if response.status_code == 200:
            return response.json()
        else:
            print(f"Error getting targeting: {response.status_code} - {response.text}")
            return None

    def get_variation_id(self, config_key: str, variation_name: str) -> Optional[str]:
        """Look up variation ID from variation name or key"""
        targeting = self.get_targeting(config_key)
        if targeting and 'variations' in targeting:
            for var in targeting['variations']:
                var_key = var.get('key') or var.get('name') or var.get('_key')
                if var_key == variation_name:
                    return var.get('_id')
        return None

    def update_targeting(self, config_key: str, environment: str,
                        instructions: List[Dict], comment: str = "") -> Optional[Dict]:
        """Update targeting with semantic patch instructions"""
        url = f"{self.base_url}/projects/{self.project_key}/ai-configs/{config_key}/targeting"

        payload = {
            "environmentKey": environment,
            "instructions": instructions,
            "comment": comment
        }

        response = requests.patch(url, headers=self.headers, json=payload)

        if response.status_code == 200:
            return response.json()
        else:
            print(f"Error: {response.status_code} - {response.text}")
            return None

    def clear_all_rules(self, config_key: str, environment: str) -> bool:
        """Remove all targeting rules from an environment using replaceRules"""
        instructions = [{"kind": "replaceRules", "rules": []}]
        result = self.update_targeting(config_key, environment, instructions, "Clear all rules")
        if result:
            print(f"[OK] Cleared all rules")
            return True
        return False

    def clear_all_targets(self, config_key: str, environment: str) -> bool:
        """Remove all individual targets from an environment using replaceTargets"""
        instructions = [{"kind": "replaceTargets", "targets": []}]
        result = self.update_targeting(config_key, environment, instructions, "Clear all targets")
        if result:
            print(f"[OK] Cleared all targets")
            return True
        return False

# Initialize
targeting = AIConfigTargeting(
    api_token=os.environ["LAUNCHDARKLY_API_TOKEN"],
    project_key="support-ai"
)
```

### View Current Targeting

```python
def view_targeting(self, config_key: str) -> Dict:
    """View current targeting configuration"""

    targeting_config = self.get_targeting(config_key)

    if targeting_config:
        print(f"[INFO] Targeting for '{config_key}':")

        variations = targeting_config.get('variations', [])

        # Show environments
        if 'environments' in targeting_config:
            for env_key, env_data in targeting_config['environments'].items():
                print(f"\n  Environment: {env_key}")
                print(f"    On: {env_data.get('on', False)}")
                print(f"    Rules: {len(env_data.get('rules', []))}")

                # Look up default variation name from index
                fallthrough_idx = env_data.get('fallthrough', {}).get('variation')
                if fallthrough_idx is not None and fallthrough_idx < len(variations):
                    var = variations[fallthrough_idx]
                    default_var = var.get('key') or var.get('name') or var.get('_key') or f'index {fallthrough_idx}'
                else:
                    default_var = 'Not set'
                print(f"    Default variation: {default_var}")

        return targeting_config
    return {}

# Example usage
current_targeting = targeting.view_targeting("chat-assistant")
```

### Add Rule with Percentage Rollout

> **Note:** For formal A/B testing with statistical analysis, use the `aiconfig-experiments` skill. Default/fallthrough variation is configured in the LaunchDarkly UI.

```python
def add_rollout_rule(self, config_key: str, environment: str,
                     clauses: List[Dict], rollout_weights: Dict[str, int],
                     rollout_context_kind: str = "user",
                     rollout_bucket_by: str = "key") -> Optional[Dict]:
    """
    Add a rule with percentage-based rollout

    Args:
        config_key: The AI Config key
        environment: Environment key
        clauses: List of clause conditions
        rollout_weights: Dict of variation_id: weight (in thousandths, 0-100000)
                        e.g., {"uuid-1": 60000, "uuid-2": 40000} for 60/40 split
        rollout_context_kind: Context kind for bucketing (default: "user")
        rollout_bucket_by: Attribute to bucket by (default: "key")
    """

    instructions = [
        {
            "kind": "addRule",
            "clauses": clauses,
            "rolloutWeights": rollout_weights,
            "rolloutContextKind": rollout_context_kind,
            "rolloutBucketBy": rollout_bucket_by
        }
    ]

    result = self.update_targeting(
        config_key,
        environment,
        instructions,
        comment="Add rule with percentage rollout"
    )

    if result:
        print(f"[OK] Rollout rule created")
    return result

# Example - 60/40 split for premium users
# First get variation IDs
targeting_data = targeting.get_targeting("chat-assistant")
var_id_list = [v['_id'] for v in targeting_data.get('variations', [])]

targeting.add_rollout_rule(
    config_key="chat-assistant",
    environment="production",
    clauses=[{
        "contextKind": "user",
        "attribute": "tier",
        "op": "in",
        "values": ["premium"],
        "negate": False
    }],
    rollout_weights={
        var_id_list[0]: 60000,  # 60%
        var_id_list[1]: 40000   # 40%
    }
)
```

### Target by User Attributes

```python
def add_attribute_rule(self, config_key: str, environment: str,
                       attribute: str, operator: str, values: List,
                       variation_id: str, context_kind: str = "user") -> Optional[Dict]:
    """
    Add a targeting rule based on context attributes

    Args:
        config_key: The AI Config key
        environment: Environment key
        attribute: Context attribute to match (e.g., "tier", "region")
        operator: Comparison operator ("in", "equals", "greaterThan", etc.)
        values: Values to match against
        variation_id: Variation ID (UUID) to serve when rule matches
        context_kind: Type of context ("user", "organization", etc.)
    """

    instructions = [
        {
            "kind": "addRule",
            "clauses": [
                {
                    "contextKind": context_kind,
                    "attribute": attribute,
                    "op": operator,
                    "values": values,
                    "negate": False
                }
            ],
            "variationId": variation_id
        }
    ]

    result = self.update_targeting(
        config_key,
        environment,
        instructions,
        comment=f"Add rule: {attribute} {operator} rule"
    )

    if result:
        print(f"[OK] Targeting rule created")
        print(f"  If {attribute} {operator} {values} -> variation {variation_id}")
    return result

# Example - Premium users get GPT-4
# First look up the variation ID
var_id = targeting.get_variation_id("chat-assistant", "gpt-4-variation")
targeting.add_attribute_rule(
    config_key="chat-assistant",
    environment="production",
    attribute="tier",
    operator="in",
    values=["premium", "enterprise"],
    variation_id=var_id
)
```

### Target Individual Contexts

```python
def target_individuals(self, config_key: str, environment: str,
                      variation_id: str, context_keys: List[str],
                      context_kind: str = "user") -> Optional[Dict]:
    """
    Target specific context keys with a variation

    Args:
        config_key: The AI Config key
        environment: Environment key
        variation_id: Variation ID (UUID) to serve
        context_keys: List of context keys to target
        context_kind: Type of context ("user", "organization", etc.)
    """

    instructions = [
        {
            "kind": "addTargets",
            "variationId": variation_id,
            "contextKind": context_kind,
            "values": context_keys
        }
    ]

    result = self.update_targeting(
        config_key,
        environment,
        instructions,
        comment=f"Add individual targets for {len(context_keys)} contexts"
    )

    if result:
        print(f"[OK] Individual targeting configured for {len(context_keys)} contexts")
    return result

# Example - Specific users for testing
var_id = targeting.get_variation_id("chat-assistant", "experimental-variation")
targeting.target_individuals(
    config_key="chat-assistant",
    environment="production",
    variation_id=var_id,
    context_keys=["test-user-1", "test-user-2", "demo-user"]
)
```

### Multi-Context Targeting

```python
def add_multi_context_rule(self, config_key: str, environment: str,
                          clauses: List[Dict],
                          variation_id: str) -> Optional[Dict]:
    """
    Add a rule targeting multiple context kinds

    Args:
        config_key: The AI Config key
        environment: Environment key
        clauses: List of clause definitions with context kinds
        variation_id: Variation ID (UUID) to serve when all clauses match
    """

    instructions = [
        {
            "kind": "addRule",
            "clauses": clauses,
            "variationId": variation_id
        }
    ]

    result = self.update_targeting(
        config_key,
        environment,
        instructions,
        comment="Add multi-context rule"
    )

    if result:
        print(f"[OK] Multi-context rule created")
    return result

# Example - Enterprise organizations with admin users get advanced features
var_id = targeting.get_variation_id("chat-assistant", "advanced-variation")
targeting.add_multi_context_rule(
    config_key="chat-assistant",
    environment="production",
    clauses=[
        {
            "contextKind": "user",
            "attribute": "role",
            "op": "in",
            "values": ["admin", "owner"],
            "negate": False
        },
        {
            "contextKind": "organization",
            "attribute": "plan",
            "op": "in",
            "values": ["enterprise"],
            "negate": False
        }
    ],
    variation_id=var_id
)
```

### Segment-Based Targeting

> **Note:** First create segments using the `aiconfig-segments` skill, then target them here.

```python
def target_segments(self, config_key: str, environment: str,
                   segment_keys: List[str], variation_id: str,
                   include: bool = True) -> Optional[Dict]:
    """
    Target pre-defined segments

    Args:
        config_key: The AI Config key
        environment: Environment key
        segment_keys: List of segment keys to target (must be created first)
        variation_id: Variation ID (UUID) to serve to segment members
        include: True to include segments, False to exclude
    """

    instructions = [
        {
            "kind": "addRule",
            "clauses": [
                {
                    "op": "segmentMatch",
                    "values": segment_keys,
                    "negate": not include
                }
            ],
            "variationId": variation_id
        }
    ]

    result = self.update_targeting(
        config_key,
        environment,
        instructions,
        comment=f"{'Include' if include else 'Exclude'} segments: {', '.join(segment_keys)}"
    )

    if result:
        action = "included" if include else "excluded"
        print(f"[OK] Segments {action}: {segment_keys}")
    return result

# Example - Beta testers segment (create with aiconfig-segments skill first)
var_id = targeting.get_variation_id("chat-assistant", "experimental-variation")
targeting.target_segments(
    config_key="chat-assistant",
    environment="production",
    segment_keys=["cookbook-beta-testers"],
    variation_id=var_id
)
```


## Operators Reference

### Comparison Operators

| Operator | Description | Example Values |
|----------|-------------|----------------|
| `in` | Value in list | `["premium", "enterprise"]` |
| `equals` | Exact match | `["active"]` |
| `contains` | String contains | `["beta"]` |
| `startsWith` | String prefix | `["user-"]` |
| `endsWith` | String suffix | `["-test"]` |
| `matches` | Regex match | `["^user-\\d+$"]` |

### Numeric Operators

| Operator | Description | Example Values |
|----------|-------------|----------------|
| `greaterThan` | > value | `[100]` |
| `greaterThanOrEqual` | >= value | `[100]` |
| `lessThan` | < value | `[100]` |
| `lessThanOrEqual` | <= value | `[100]` |

### Date/Time Operators

| Operator | Description | Example Values |
|----------|-------------|----------------|
| `before` | Before date | `["2024-12-31T00:00:00Z"]` |
| `after` | After date | `["2024-01-01T00:00:00Z"]` |

### Semantic Version Operators

| Operator | Description | Example Values |
|----------|-------------|----------------|
| `semVerEqual` | Version equals | `["2.0.0"]` |
| `semVerLessThan` | Version < | `["2.0.0"]` |
| `semVerGreaterThan` | Version > | `["1.0.0"]` |

## Best Practices

1. **Rule Order Matters**
   - Most specific rules first
   - General rules later
   - Default rule is always last

2. **Percentage Rollouts**
   - Use percentage splits to gradually roll out variations
   - Monitor metrics to determine winning variation
   - Remember: splits are static; for formal experiments, see `aiconfig-experiments`

3. **Context Attributes**
   - Keep attribute names consistent
   - Use meaningful values
   - Document custom attributes

4. **Testing Strategy**
   - Test in staging environment first
   - Use individual targeting for QA
   - Monitor metrics after changes

5. **Multi-Context Rules**
   - Use for B2B scenarios
   - Combine user + organization contexts
   - Test all combinations

## Common Patterns

### Tier-Based Model Selection
Use `add_attribute_rule()` with `attribute="tier"` to serve different variations based on user subscription level:
- Free tier → cost-efficient model variation
- Pro/Business tier → balanced model variation
- Enterprise tier → premium model variation

### Geographic Targeting
Use `add_attribute_rule()` with `attribute="country"` to target users by region:
- Useful for compliance (data residency)
- Regional model rollouts
- Localized prompt variations

### Segment-Based Rollouts
Use `target_segments()` with segments created via `aiconfig-segments` skill:
- Beta testers get experimental variations
- Internal users get debug variations
- Gradually expand to wider audiences

## Error Handling

Common errors and solutions:

- **404 Not Found**: Check AI Config key exists in project
- **400 Bad Request**: Validate instruction format and required fields; ensure operators are lower-case
- **403 Forbidden**: Verify API token has write permissions
- **409 Conflict**: Check for rule conflicts or duplicate targets
- **422 Unprocessable**: Ensure variation IDs (UUIDs) are valid and exist in the AI Config

## Next Steps

- **Monitor performance**: Use `aiconfig-ai-metrics` to track impact
- **Update variations**: Use `aiconfig-variations` to modify prompts
- **Manage segments**: Use `aiconfig-segments` to create reusable segments
- **Add quality monitoring**: Use `aiconfig-online-evals` for judge-based evaluation

## Related Skills

### Core Workflow
- `aiconfig-create` - Create AI Configs first
- `aiconfig-sdk` - Integrate configs in your application
- `aiconfig-variations` - Create variations to target

### Context & Segmentation
- `aiconfig-context-basic` - Basic context patterns
- `aiconfig-context-advanced` - Advanced multi-context patterns
- `aiconfig-segments` - Create user segments for targeting

### Testing & Monitoring
- `aiconfig-experiments` - Run A/B tests with targeting
- `aiconfig-ai-metrics` - Track metrics by segment
- `aiconfig-custom-metrics` - Track business metrics
## References

- [Target with AI Configs](https://docs.launchdarkly.com/home/ai-configs/target)
- [Targeting Rules](https://docs.launchdarkly.com/home/flags/target-rules)
- [Context Attributes](https://docs.launchdarkly.com/home/flags/context-attributes)
- [API Documentation](https://apidocs.launchdarkly.com)