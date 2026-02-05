---
name: aiconfig-segments
description: Create and manage segments for AI Config targeting. Segments let you group contexts (users, organizations, devices) to target them as a unit in your AI Config rules.
compatibility: Requires LaunchDarkly API access token with segments:write permission.
metadata:
  author: launchdarkly
  version: "0.1.0"
---

# AI Config Segments Management

Create, manage, and target segments to control which contexts receive specific AI Config variations. Segments enable bulk targeting without listing individual users.

## Prerequisites

- LaunchDarkly API access token with `segments:write` permission
- Project key and environment key
- Understanding of LaunchDarkly contexts (see `aiconfig-context-basic`)

## What Are Segments?

Segments are reusable groups of contexts that you can target across multiple AI Configs. They help you:
- **Group similar users**: Beta testers, enterprise customers, internal employees
- **Target by attributes**: All users in a region, with specific roles, or meeting certain criteria
- **Simplify targeting**: Reference a segment instead of repeating complex rules
- **A/B test cohorts**: Define experiment groups once, use everywhere

## Python SDK Implementation

### Complete Segments Management Class

```python
import requests
import os
import time
from typing import Dict, List, Optional, Any

class AIConfigSegments:
    """Manage segments for AI Config targeting"""

    def __init__(self, api_token: str, project_key: str, environment: str = "production"):
        self.api_token = api_token
        self.project_key = project_key
        self.environment = environment
        self.base_url = "https://app.launchdarkly.com/api/v2"
        self.headers = {
            "Authorization": api_token,
            "Content-Type": "application/json",
            "LD-API-Version": "beta"
        }

    def create_segment(self, key: str, name: str, description: str = None, tags: List[str] = None) -> Dict:
        """
        Create a new segment for targeting.

        Args:
            key: Unique segment identifier (lowercase, hyphens)
            name: Human-readable segment name
            description: Optional description
            tags: Optional tags for organization

        Returns:
            Created segment details
        """
        url = f"{self.base_url}/segments/{self.project_key}/{self.environment}"

        payload = {
            "key": key,
            "name": name
        }

        if description:
            payload["description"] = description
        if tags:
            payload["tags"] = tags

        response = requests.post(url, headers=self.headers, json=payload)

        if response.status_code in [200, 201]:
            print(f"[OK] Created segment '{key}'")
            time.sleep(0.5)
            return response.json()
        elif response.status_code == 409:
            print(f"[WARNING] Segment '{key}' already exists")
            return self.get_segment(key)
        else:
            print(f"[ERROR] Failed to create segment: {response.text}")
            return None

    def add_segment_rules(self, segment_key: str, rules: List[Dict]) -> Dict:
        """
        Add targeting rules to a segment.

        Args:
            segment_key: The segment to update
            rules: List of rule clauses

        Returns:
            Updated segment details
        """
        url = f"{self.base_url}/segments/{self.project_key}/{self.environment}/{segment_key}"

        # Build semantic patch instructions
        instructions = []

        for rule in rules:
            clauses = []
            for clause in rule.get("clauses", []):
                clauses.append({
                    "attribute": clause["attribute"],
                    "op": clause["op"],
                    "values": clause["values"],
                    "contextKind": clause.get("contextKind", "user"),
                    "negate": clause.get("negate", False)
                })

            if clauses:
                instructions.append({
                    "kind": "addRule",
                    "clauses": clauses
                })

        payload = {
            "environmentKey": self.environment,
            "instructions": instructions
        }

        # Use semantic patch headers
        patch_headers = self.headers.copy()
        patch_headers["Content-Type"] = "application/json; domain-model=launchdarkly.semanticpatch"

        response = requests.patch(url, headers=patch_headers, json=payload)

        if response.status_code == 200:
            print(f"[OK] Added {len(instructions)} rules to segment '{segment_key}'")
            return response.json()
        else:
            print(f"[ERROR] Failed to add rules: {response.text}")
            return None

    def get_segment(self, segment_key: str) -> Dict:
        """Get segment details"""
        url = f"{self.base_url}/segments/{self.project_key}/{self.environment}/{segment_key}"

        response = requests.get(url, headers=self.headers)

        if response.status_code == 200:
            return response.json()
        else:
            print(f"[ERROR] Failed to get segment: {response.text}")
            return None

    def list_segments(self, limit: int = 50) -> List[Dict]:
        """List all segments in the environment"""
        url = f"{self.base_url}/segments/{self.project_key}/{self.environment}"

        params = {"limit": limit}
        response = requests.get(url, headers=self.headers, params=params)

        if response.status_code == 200:
            data = response.json()
            segments = data.get("items", [])

            print(f"[INFO] Found {len(segments)} segments:")
            for segment in segments:
                rule_count = len(segment.get("rules", []))
                print(f"   - {segment['name']} ({segment['key']}) - {rule_count} rules")

            return segments
        else:
            print(f"[ERROR] Failed to list segments: {response.text}")
            return []

    def delete_segment(self, segment_key: str) -> bool:
        """Delete a segment"""
        url = f"{self.base_url}/segments/{self.project_key}/{self.environment}/{segment_key}"

        response = requests.delete(url, headers=self.headers, json={})

        if response.status_code == 204:
            print(f"[OK] Deleted segment '{segment_key}'")
            return True
        else:
            print(f"[ERROR] Failed to delete segment: {response.text}")
            return False

# Example usage
if __name__ == "__main__":
    API_TOKEN = os.environ.get("LAUNCHDARKLY_API_TOKEN")
    PROJECT_KEY = "default"

    segments = AIConfigSegments(API_TOKEN, PROJECT_KEY, "production")

    # Create a segment
    beta_segment = segments.create_segment(
        key="beta-testers",
        name="Beta Testers",
        description="Users who have opted into beta features",
        tags=["beta", "testing"]
    )

    # Add rules to target specific users
    segments.add_segment_rules(
        "beta-testers",
        [
            {
                "clauses": [
                    {
                        "attribute": "beta_opted_in",
                        "op": "in",
                        "values": [True]
                    }
                ]
            }
        ]
    )
```

## API Examples

### Example 1: Create Beta Testers Segment

```python
def create_beta_testers_segment():
    """
    Create a segment for beta testers with multiple targeting criteria.
    """

    API_TOKEN = os.environ.get("LAUNCHDARKLY_API_TOKEN")
    PROJECT_KEY = "default"
    ENVIRONMENT = "production"

    # Step 1: Create the segment
    url = f"https://app.launchdarkly.com/api/v2/segments/{PROJECT_KEY}/{ENVIRONMENT}"

    payload = {
        "key": "ai-beta-testers",
        "name": "AI Beta Testers",
        "description": "Users testing new AI features",
        "tags": ["beta", "ai-configs", "testing"]
    }

    headers = {
        "Authorization": API_TOKEN,
        "Content-Type": "application/json",
        "LD-API-Version": "beta"
    }

    response = requests.post(url, headers=headers, json=payload)

    if response.status_code not in [200, 201]:
        print(f"[ERROR] Failed to create segment: {response.text}")
        return None

    print(f"[OK] Created segment 'ai-beta-testers'")
    time.sleep(0.5)

    # Step 2: Add targeting rules
    segment_key = "ai-beta-testers"
    url = f"https://app.launchdarkly.com/api/v2/segments/{PROJECT_KEY}/{ENVIRONMENT}/{segment_key}"

    instructions = [
        {
            "kind": "addRule",
            "clauses": [
                {
                    "attribute": "beta_tester",
                    "op": "in",
                    "values": [True],
                    "contextKind": "user",
                    "negate": False
                },
                {
                    "attribute": "accountAge",
                    "op": "greaterThan",
                    "values": [30],
                    "contextKind": "user",
                    "negate": False
                }
            ]
        }
    ]

    payload = {
        "environmentKey": ENVIRONMENT,
        "instructions": instructions
    }

    patch_headers = headers.copy()
    patch_headers["Content-Type"] = "application/json; domain-model=launchdarkly.semanticpatch"

    response = requests.patch(url, headers=patch_headers, json=payload)

    if response.status_code == 200:
        print(f"[OK] Added targeting rules to segment")
        return response.json()
    else:
        print(f"[ERROR] Failed to add rules: {response.text}")
        return None

# Execute
create_beta_testers_segment()
```

### Example 2: Create Enterprise Customers Segment

```python
def create_enterprise_segment():
    """
    Create a segment for enterprise customers with complex rules.
    """

    API_TOKEN = os.environ.get("LAUNCHDARKLY_API_TOKEN")
    PROJECT_KEY = "default"
    ENVIRONMENT = "production"

    # Step 1: Create the segment
    url = f"https://app.launchdarkly.com/api/v2/segments/{PROJECT_KEY}/{ENVIRONMENT}"

    payload = {
        "key": "enterprise-customers",
        "name": "Enterprise Customers",
        "description": "Organizations on enterprise plans",
        "tags": ["enterprise", "premium", "ai-configs"]
    }

    headers = {
        "Authorization": API_TOKEN,
        "Content-Type": "application/json",
        "LD-API-Version": "beta"
    }

    response = requests.post(url, headers=headers, json=payload)

    if response.status_code not in [200, 201]:
        print(f"[ERROR] Failed to create segment: {response.text}")
        return None

    print(f"[OK] Created segment 'enterprise-customers'")
    time.sleep(0.5)

    # Step 2: Add multiple rules for different criteria
    segment_key = "enterprise-customers"
    url = f"https://app.launchdarkly.com/api/v2/segments/{PROJECT_KEY}/{ENVIRONMENT}/{segment_key}"

    instructions = [
        {
            "kind": "addRule",
            "clauses": [
                {
                    "attribute": "plan",
                    "op": "in",
                    "values": ["enterprise", "enterprise-plus"],
                    "contextKind": "organization",
                    "negate": False
                }
            ]
        },
        {
            "kind": "addRule",
            "clauses": [
                {
                    "attribute": "mrr",
                    "op": "greaterThan",
                    "values": [10000],
                    "contextKind": "organization",
                    "negate": False
                }
            ]
        },
        {
            "kind": "addRule",
            "clauses": [
                {
                    "attribute": "customContract",
                    "op": "in",
                    "values": [True],
                    "contextKind": "organization",
                    "negate": False
                }
            ]
        }
    ]

    payload = {
        "environmentKey": ENVIRONMENT,
        "instructions": instructions
    }

    patch_headers = headers.copy()
    patch_headers["Content-Type"] = "application/json; domain-model=launchdarkly.semanticpatch"

    response = requests.patch(url, headers=patch_headers, json=payload)

    if response.status_code == 200:
        print(f"[OK] Added {len(instructions)} rules to segment")
        return response.json()
    else:
        print(f"[ERROR] Failed to add rules: {response.text}")
        return None

# Execute
create_enterprise_segment()
```

### Example 3: Regional Segment with Multi-Context

```python
def create_regional_segment():
    """
    Create a segment targeting users in specific regions with certain attributes.
    """

    API_TOKEN = os.environ.get("LAUNCHDARKLY_API_TOKEN")
    PROJECT_KEY = "default"
    ENVIRONMENT = "production"

    # Create segment
    url = f"https://app.launchdarkly.com/api/v2/segments/{PROJECT_KEY}/{ENVIRONMENT}"

    payload = {
        "key": "eu-power-users",
        "name": "EU Power Users",
        "description": "High-usage customers in European region",
        "tags": ["regional", "eu", "power-users"]
    }

    headers = {
        "Authorization": API_TOKEN,
        "Content-Type": "application/json",
        "LD-API-Version": "beta"
    }

    response = requests.post(url, headers=headers, json=payload)

    if response.status_code not in [200, 201]:
        if response.status_code != 409:  # Not already exists
            print(f"[ERROR] Failed to create segment: {response.text}")
            return None

    print(f"[OK] Created segment 'eu-power-users'")

    # Add complex targeting rules
    segment_key = "eu-power-users"
    url = f"https://app.launchdarkly.com/api/v2/segments/{PROJECT_KEY}/{ENVIRONMENT}/{segment_key}"

    instructions = [
        {
            "kind": "addRule",
            "clauses": [
                {
                    "attribute": "region",
                    "op": "in",
                    "values": ["eu-west", "eu-central", "eu-north"],
                    "contextKind": "user",
                    "negate": False
                },
                {
                    "attribute": "monthlyUsage",
                    "op": "greaterThan",
                    "values": [1000],
                    "contextKind": "user",
                    "negate": False
                }
            ]
        }
    ]

    payload = {
        "environmentKey": ENVIRONMENT,
        "instructions": instructions
    }

    patch_headers = headers.copy()
    patch_headers["Content-Type"] = "application/json; domain-model=launchdarkly.semanticpatch"

    response = requests.patch(url, headers=patch_headers, json=payload)

    if response.status_code == 200:
        print(f"[OK] Added regional targeting rules")
        return response.json()
    else:
        print(f"[ERROR] Failed to add rules: {response.text}")
        return None

# Execute
create_regional_segment()
```

## Using Segments in AI Config Targeting

After creating segments, use the `aiconfig-targeting` skill to target them in your AI Configs. The targeting skill provides the `target_segments()` method for this purpose.

See `aiconfig-targeting` for:
- Targeting segments with specific variations
- Combining segment rules with other targeting criteria
- Setting up percentage rollouts within segments

## Segment Rule Operators

### Common Operators for Rules

```python
# Operator reference
OPERATORS = {
    "in": "Matches any of the values",
    "endsWith": "Attribute ends with value",
    "startsWith": "Attribute starts with value",
    "matches": "Regex match",
    "contains": "Contains substring",
    "greaterThan": "Numeric greater than",
    "lessThan": "Numeric less than",
    "greaterThanOrEqual": "Numeric >=",
    "lessThanOrEqual": "Numeric <=",
    "before": "Date before (Unix millis)",
    "after": "Date after (Unix millis)",
    "semVerEqual": "Semantic version equals",
    "semVerLessThan": "Semantic version less than",
    "semVerGreaterThan": "Semantic version greater than",
    "segmentMatch": "Matches another segment"
}

# Example: Complex rule with multiple operators
complex_rule = {
    "clauses": [
        {
            "attribute": "email",
            "op": "endsWith",
            "values": ["@company.com"],
            "contextKind": "user"
        },
        {
            "attribute": "accountCreated",
            "op": "before",
            "values": [1704067200000],  # Jan 1, 2024
            "contextKind": "user"
        },
        {
            "attribute": "version",
            "op": "semVerGreaterThan",
            "values": ["2.0.0"],
            "contextKind": "device"
        }
    ]
}
```

## Best Practices

### 1. Segment Naming Conventions

```python
# Use clear, descriptive names
segment_naming = {
    "beta-testers": "Users testing new features",
    "enterprise-tier": "Enterprise plan customers",
    "internal-employees": "Company employees",
    "high-value-users": "Top revenue generating users",
    "regional-eu": "European region users"
}
```

### 2. Rule Organization

```python
# Group related criteria in single rules
good_rule = {
    "clauses": [
        {"attribute": "plan", "op": "in", "values": ["pro", "enterprise"]},
        {"attribute": "accountAge", "op": "greaterThan", "values": [90]}
    ]
}

# Avoid overly complex single rules
# Instead, use multiple simpler rules
```

### 3. Performance Considerations

```python
# For large segments (>15,000 members), consider:
# 1. Using list-based segments instead of rules
# 2. Syncing from external systems
# 3. Using the Big Segments feature (Enterprise)
```

## Managing Segment Membership

### Add Individual Contexts to Segment

```python
def add_contexts_to_segment(segment_key: str, context_keys: List[str]):
    """Add specific contexts to a segment"""

    API_TOKEN = os.environ.get("LAUNCHDARKLY_API_TOKEN")
    PROJECT_KEY = "default"
    ENVIRONMENT = "production"

    url = f"https://app.launchdarkly.com/api/v2/segments/{PROJECT_KEY}/{ENVIRONMENT}/{segment_key}"

    instructions = [
        {
            "kind": "addIncludedTargets",
            "contextKind": "user",
            "values": context_keys
        }
    ]

    payload = {
        "environmentKey": ENVIRONMENT,
        "instructions": instructions
    }

    headers = {
        "Authorization": API_TOKEN,
        "Content-Type": "application/json; domain-model=launchdarkly.semanticpatch"
    }

    response = requests.patch(url, headers=headers, json=payload)

    if response.status_code == 200:
        print(f"[OK] Added {len(context_keys)} contexts to segment")
        return response.json()
    else:
        print(f"[ERROR] Failed to add contexts: {response.text}")
        return None

# Add specific users to beta testers
add_contexts_to_segment(
    "beta-testers",
    ["user-123", "user-456", "user-789"]
)
```

### Exclude Contexts from Segment

```python
def exclude_contexts_from_segment(segment_key: str, context_keys: List[str]):
    """Exclude specific contexts from a segment"""

    API_TOKEN = os.environ.get("LAUNCHDARKLY_API_TOKEN")
    PROJECT_KEY = "default"
    ENVIRONMENT = "production"

    url = f"https://app.launchdarkly.com/api/v2/segments/{PROJECT_KEY}/{ENVIRONMENT}/{segment_key}"

    instructions = [
        {
            "kind": "addExcludedTargets",
            "contextKind": "user",
            "values": context_keys
        }
    ]

    payload = {
        "environmentKey": ENVIRONMENT,
        "instructions": instructions
    }

    headers = {
        "Authorization": API_TOKEN,
        "Content-Type": "application/json; domain-model=launchdarkly.semanticpatch"
    }

    response = requests.patch(url, headers=headers, json=payload)

    if response.status_code == 200:
        print(f"[OK] Excluded {len(context_keys)} contexts from segment")
        return response.json()
    else:
        print(f"[ERROR] Failed to exclude contexts: {response.text}")
        return None

# Exclude specific users even if they match rules
exclude_contexts_from_segment(
    "beta-testers",
    ["user-999"]  # This user won't be in segment even if they match rules
)
```

## Common Errors and Solutions

### 1. Segment Already Exists
```python
# Solution: Check existence first or update existing
def create_or_update_segment(key: str, name: str):
    segments = AIConfigSegments(API_TOKEN, PROJECT_KEY)

    existing = segments.get_segment(key)
    if existing:
        print(f"Segment '{key}' exists, updating...")
        # Update logic here
    else:
        segments.create_segment(key, name)
```

### 2. Invalid Context Kind
```python
# Valid context kinds must be created first
# Default: "user"
# Custom: "organization", "device", etc.
# See aiconfig-context-advanced skill
```

### 3. Rule Conflicts
```python
# Avoid contradictory rules
# Bad: Including and excluding the same attribute value
# Good: Use separate rules with clear logic
```

## Next Steps

After creating segments:
1. **Use in AI Config targeting** - See `aiconfig-targeting` skill
2. **Test segment membership** - Verify contexts match expected rules
3. **Monitor segment size** - Track growth and performance
4. **Set up experiments** - Use segments for A/B testing

## Related Skills

### Segmentation Workflow
- `aiconfig-targeting` - Use segments in targeting
- `aiconfig-context-basic` - Build contexts for segments
- `aiconfig-context-advanced` - Complex segmentation

### Analysis
- `aiconfig-experiments` - Segment-based experiments
- `aiconfig-ai-metrics` - Metrics by segment
- `aiconfig-custom-metrics` - Business metrics by segment
## References

- [Segments Documentation](https://docs.launchdarkly.com/home/flags/segments)
- [Segment API Reference](https://apidocs.launchdarkly.com/tag/Segments/)
- [Targeting with Segments](https://docs.launchdarkly.com/home/flags/segment-targeting)