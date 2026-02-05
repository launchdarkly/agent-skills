---
name: aiconfig-context-basic
description: Build and manage user contexts for LaunchDarkly AI Config targeting. Use this skill to create contexts with attributes for personalization, segmentation, and experimentation.
compatibility: Requires launchdarkly-server-sdk Python package.
metadata:
  author: launchdarkly
  version: "0.1.0"
---

# Context Basics for AI Config

Build user contexts with attributes to enable targeted AI Config delivery, personalization, and experimentation. Contexts work identically for AI Configs and feature flags.

## Prerequisites

- LaunchDarkly SDK key
- Python 3.8+
- launchdarkly-server-sdk and launchdarkly-server-sdk-ai packages

## Core Concepts

**Important**: AI Configs use the same context system as feature flags. The context you provide determines which AI Config variation is served, just like with flags.

Contexts are data objects that represent users, devices, organizations, or other entities. They determine:
- Which AI Config variation a user receives
- How prompts are personalized (via `{{ ldctx.attribute }}`)
- Experiment segmentation
- Metric aggregation

## Implementation

### Simple Context Creation

```python
from ldclient import Context

def create_basic_context(user_id: str):
    """Create a simple context with just user ID"""

    # User ID is the minimum required
    context = Context.builder(user_id).build()
    return context

# Example
context = create_basic_context("user-123")
```

### Context with Common Attributes

```python
def create_user_context(
    user_id: str,
    email: str = None,
    name: str = None,
    tier: str = None,
    country: str = None
):
    """Create context with common user attributes"""

    builder = Context.builder(user_id)

    # Add attributes used for targeting
    if email:
        builder.set("email", email)
    if name:
        builder.set("name", name)
    if tier:
        builder.set("tier", tier)
    if country:
        builder.set("country", country)

    return builder.build()

# Example
context = create_user_context(
    user_id="user-123",
    email="anna@example.com",
    name="Anna Smith",
    tier="premium",
    country="US"
)
```

### Context for Business Applications

```python
def create_business_context(user_id: str, user_data: dict, org_data: dict):
    """Create context for B2B applications"""

    builder = Context.builder(user_id)

    # User attributes
    builder.set("role", user_data.get("role"))
    builder.set("department", user_data.get("department"))

    # Organization attributes
    builder.set("companyName", org_data.get("name"))
    builder.set("companySize", org_data.get("size"))
    builder.set("industry", org_data.get("industry"))
    builder.set("plan", org_data.get("plan"))

    return builder.build()

# Example
context = create_business_context(
    "user-123",
    user_data={"role": "developer", "department": "engineering"},
    org_data={"name": "TechCorp", "size": "enterprise", "industry": "software", "plan": "premium"}
)
```

## Multi-Context for Complex Scenarios

Multi-contexts let you target based on both user AND organization attributes:

```python
def create_multi_context(user_id: str, org_id: str, user_attrs: dict, org_attrs: dict):
    """Create multi-context for user within organization"""

    # Build user context
    user_context = Context.builder(user_id).kind("user")
    for key, value in user_attrs.items():
        user_context.set(key, value)

    # Build organization context
    org_context = Context.builder(org_id).kind("organization")
    for key, value in org_attrs.items():
        org_context.set(key, value)

    # Combine contexts
    multi_context = Context.multi_builder() \
        .add(user_context.build()) \
        .add(org_context.build()) \
        .build()

    return multi_context

# Example
context = create_multi_context(
    user_id="user-123",
    org_id="org-456",
    user_attrs={"role": "developer", "experience": "senior"},
    org_attrs={"plan": "enterprise", "industry": "fintech"}
)
```
→ **Learn more**: See `aiconfig-targeting` for multi-context targeting rules

## Date and Time Attributes

LaunchDarkly supports two formats for date/time attributes:

```python
from datetime import datetime

def add_date_attributes(builder, signup_date):
    """Add date attributes in supported formats"""

    # Option 1: Unix timestamp in milliseconds
    timestamp_ms = int(signup_date.timestamp() * 1000)
    builder.set("signupTimestamp", timestamp_ms)

    # Option 2: RFC 3339 string
    rfc3339_date = signup_date.isoformat() + "Z"
    builder.set("signupDate", rfc3339_date)

    # Computed: Days since signup
    days_since = (datetime.now() - signup_date).days
    builder.set("accountAgeDays", days_since)

    return builder
```

## Anonymous Contexts

For users who haven't logged in:

```python
import uuid

def create_anonymous_context(session_id: str = None, **attributes):
    """Create context for anonymous users"""

    # Generate stable ID if not provided
    if not session_id:
        session_id = str(uuid.uuid4())

    builder = Context.builder(session_id)
    builder.anonymous(True)

    # Add trackable attributes
    for key, value in attributes.items():
        builder.set(key, value)

    return builder.build()

# Example
context = create_anonymous_context(
    referrer="google",
    landingPage="/pricing",
    deviceType="mobile"
)
```

## Using Contexts with AI Configs

Once you've built a context, use it with the AI SDK to get config variations. See `aiconfig-sdk` for complete SDK usage patterns including:
- Initializing the SDK
- Fetching completion and agent configs
- Handling fallbacks
- Tracking metrics

## Best Practices

### 1. Privacy and PII

```python
import hashlib

# ❌ DON'T use PII as context keys
context = Context.builder(user_email).build()  # Bad

# ✅ DO use opaque identifiers
context = Context.builder(user_id).build()  # Good

# If you need email for targeting, hash it
hashed_email = hashlib.sha256(email.encode()).hexdigest()
context = Context.builder(user_id).set("emailHash", hashed_email).build()
```

### 2. Fresh Context Per Request

```python
# ❌ DON'T cache contexts across users
cached_context = create_context("user-1")  # Created once
for request in requests:
    config = get_config(cached_context)  # Wrong! All users get same context

# ✅ DO create fresh context for each request
for request in requests:
    context = create_context(request.user_id)  # Fresh context
    config = get_config(context)  # Correct!
```

### 3. Only Include Necessary Attributes

```python
# ❌ DON'T include everything
context = Context.builder(user_id)
for key, value in all_user_data.items():  # 50+ attributes
    context.set(key, value)

# ✅ DO include only what's needed for targeting
context = Context.builder(user_id)
    .set("tier", user.tier)      # Used in targeting
    .set("region", user.region)  # Used in targeting
    .set("name", user.name)      # Used in personalization
    .build()
```

## Common Use Cases for AI Configs

### E-commerce AI Shopping Assistant
```python
# Attributes for AI model selection and personalization
# - tier: Select GPT-4 for premium, GPT-3.5 for free
# - name: Personalize greetings via {{ ldctx.name }}
# - preferredCategory: Tailor product recommendations
context = Context.builder(user_id) \
    .set("tier", "premium") \
    .set("name", "Sarah") \
    .set("preferredCategory", "electronics") \
    .set("recentPurchases", 5) \
    .build()
```

### SaaS AI Copilot
```python
# Attributes for AI feature access and model selection
# - plan: Enterprise gets advanced models, free gets basic
# - aiCreditsRemaining: Control AI usage limits
# - role/department: Customize AI assistant behavior
context = Context.builder(user_id) \
    .set("plan", "enterprise") \
    .set("aiCreditsRemaining", 500) \
    .set("role", "developer") \
    .set("department", "engineering") \
    .build()
```

### Content Platform AI Writer
```python
# Attributes for AI writing style and audience
# - writingStyle: formal, casual, technical
# - targetAudience: beginner, intermediate, expert
# - language: Output language for AI responses
context = Context.builder(user_id) \
    .set("writingStyle", "technical") \
    .set("targetAudience", "expert") \
    .set("language", "en") \
    .set("brandVoice", "professional") \
    .build()
```

## Next Steps

- **Set up targeting**: Use `aiconfig-targeting` to serve different variations based on context attributes
- **Track metrics**: Use `aiconfig-ai-metrics` to measure success by context attributes
- **Advanced patterns**: See `aiconfig-context-advanced` for enrichment pipelines and complex scenarios
- **Create segments**: Use `aiconfig-segments` for reusable targeting groups

## Related Skills

### Next Steps
- `aiconfig-context-advanced` - Advanced multi-context patterns
- `aiconfig-targeting` - Use contexts for targeting
- `aiconfig-sdk` - Implement contexts in code

### Core Workflow
- `aiconfig-create` - Create AI Configs to target
- `aiconfig-variations` - Create variations for different contexts
- `aiconfig-experiments` - Test with different contexts

### Monitoring
- `aiconfig-ai-metrics` - Track metrics by context
- `aiconfig-custom-metrics` - Business metrics by segment
## References

- [Contexts Documentation](https://docs.launchdarkly.com/home/flags/contexts)
- [Context Attributes](https://docs.launchdarkly.com/home/flags/context-attributes)
- [Target with AI Configs](https://docs.launchdarkly.com/home/ai-configs/target)
- [Python AI SDK](https://docs.launchdarkly.com/sdk/ai/python)