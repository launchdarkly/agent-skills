---
name: aiconfig-context-advanced
description: Build safe, scalable contexts for LaunchDarkly AI Configs with cardinality controls, multi-context patterns, and agent graph attributes.
compatibility: Python 3.9+, launchdarkly-server-sdk
metadata:
  author: launchdarkly
  version: "0.2.0"
---

# Advanced Context Patterns for AI Config

Advanced patterns for context enrichment, multi-context scenarios, performance optimization, and comprehensive attribute reference for partner integrations.

## Prerequisites

- Understanding of basic context patterns (see `aiconfig-context-basic`)
- LaunchDarkly SDK key (retrieve via API: `GET /api/v2/projects/{projectKey}/environments`)
- Python 3.9+ (required by SDK)
- launchdarkly-server-sdk and launchdarkly-server-sdk-ai packages

> **Note**: The AI SDK (launchdarkly-server-sdk-ai) is currently in **alpha** and under active development. APIs and behavior may change.

## Important Constraints

- **Attribute names cannot contain dots (`.`)** but nested objects are supported
- Reference nested values in templates using: `{{ ldctx.user.name }}`
- The `key` and `kind` attributes are always sent and **cannot be private**
- Private attributes are still sent to LaunchDarkly but not stored in the dashboard

## Context Patterns by Use Case

### 1. Experimentation & Testing

Build contexts optimized for A/B testing and experimentation:

```python
from ldclient import Context
import hashlib
from datetime import datetime

def build_experiment_context(user_id: str, user_data: dict):
    """Build context with experiment-relevant attributes"""

    builder = Context.builder(user_id)

    # Core segmentation attributes
    builder.set("tier", user_data.get("subscription_tier", "free"))
    builder.set("accountAgeDays", calculate_age_days(user_data.get("created_at")))
    builder.set("usageLevel", categorize_usage(user_data.get("api_calls_monthly", 0)))

    # Experiment cohort assignment
    builder.set("experimentCohort", user_data.get("cohort", "default"))

    # Stable bucketing for consistent assignment
    bucket = int(hashlib.md5(user_id.encode()).hexdigest()[:8], 16) % 100
    builder.set("experimentBucket", bucket)

    # Time-based cohorts for rollout analysis
    week_number = datetime.now().isocalendar()[1]
    builder.set("cohortWeek", week_number)

    return builder.build()

def categorize_usage(api_calls: int) -> str:
    """Categorize usage levels for segmentation"""
    if api_calls > 100000:
        return "power_user"
    elif api_calls > 10000:
        return "active"
    elif api_calls > 1000:
        return "regular"
    else:
        return "light"
```

**Why these attributes matter:**
- `tier` - Segment results by subscription level
- `accountAgeDays` - Compare new vs established users
- `usageLevel` - Analyze power users separately
- `experimentBucket` - Stable random assignment
- `cohortWeek` - Time-based analysis

→ **Set up targeting**: See `aiconfig-targeting`
→ **Analyze results**: See `aiconfig-ai-metrics`

### 2. Targeted Deployments & Canary Testing

Context patterns for targeted deployments and canary testing:

```python
def build_deployment_context(user_id: str, user_data: dict, org_data: dict = None):
    """Context for targeted deployments and canary testing"""

    builder = Context.builder(user_id)

    # Risk tolerance indicators
    builder.set("betaTester", user_data.get("opted_into_beta", False))

    # Parse date properly for comparison
    from datetime import datetime
    signup_date = datetime.fromisoformat(user_data.get("signup_date", "2024-01-01"))
    builder.set("earlyAdopter", signup_date < datetime(2023, 1, 1))

    # Organizational risk profile
    if org_data:
        builder.set("orgRiskTolerance", org_data.get("risk_profile", "conservative"))
        builder.set("orgSize", org_data.get("employee_count", 0))

    # Geographic targeting
    builder.set("region", user_data.get("region", "us-east"))
    builder.set("dataCenter", map_to_datacenter(user_data.get("region")))

    # Performance tier for capacity management
    builder.set("performanceTier", calculate_performance_tier(user_data))

    return builder.build()

def calculate_performance_tier(user_data: dict) -> str:
    """Determine performance tier for capacity planning"""
    if user_data.get("plan") == "enterprise" and user_data.get("sla") == "premium":
        return "high_priority"
    elif user_data.get("plan") in ["business", "enterprise"]:
        return "standard"
    else:
        return "best_effort"
```

→ **Configure targeting**: See `aiconfig-targeting`
→ **Set up percentage splits**: Use targeting rules for A/B testing

### 3. Multi-Context for B2B Applications

Sophisticated multi-context patterns for enterprise applications:

```python
def build_b2b_contexts(user_data: dict, org_data: dict, workspace_data: dict = None):
    """Build comprehensive B2B multi-context"""

    # User context
    user_context = Context.builder(user_data["id"]).kind("user")
    user_context.set("role", user_data.get("role"))
    user_context.set("department", user_data.get("department"))
    user_context.set("permissions", user_data.get("permission_level"))
    user_context.set("lastActive", user_data.get("last_activity"))

    # Organization context
    org_context = Context.builder(org_data["id"]).kind("organization")
    org_context.set("tier", org_data.get("plan"))
    org_context.set("industry", org_data.get("industry"))
    org_context.set("size", categorize_org_size(org_data.get("employee_count")))
    org_context.set("mrr", org_data.get("monthly_revenue"))
    org_context.set("features", org_data.get("enabled_features", []))

    # Optional workspace/team context
    multi_builder = Context.multi_builder()
    multi_builder.add(user_context.build())
    multi_builder.add(org_context.build())

    if workspace_data:
        workspace_context = Context.builder(workspace_data["id"]).kind("workspace")
        workspace_context.set("name", workspace_data.get("name"))
        workspace_context.set("type", workspace_data.get("type"))
        workspace_context.set("memberCount", workspace_data.get("member_count"))
        multi_builder.add(workspace_context.build())

    return multi_builder.build()

def categorize_org_size(employee_count: int) -> str:
    """Categorize organization size"""
    if employee_count > 1000:
        return "enterprise"
    elif employee_count > 100:
        return "mid_market"
    elif employee_count > 10:
        return "small_business"
    else:
        return "startup"
```

→ **Target by organization**: See `aiconfig-targeting` for multi-context rules
→ **B2B experiments**: Consider organization-level randomization

### 4. Context Enrichment Pipeline

Pattern for enriching contexts with external data:

```python
class ContextEnrichmentPipeline:
    """Pipeline for enriching contexts with external data"""

    def __init__(self):
        self.enrichers = []

    def add_enricher(self, enricher):
        """Add an enrichment step"""
        self.enrichers.append(enricher)
        return self

    def enrich(self, base_context_data: dict) -> Context:
        """Build enriched context"""
        user_id = base_context_data["user_id"]
        builder = Context.builder(user_id)

        # Apply each enricher
        enriched_data = base_context_data.copy()
        for enricher in self.enrichers:
            enriched_data = enricher(enriched_data)

        # Build context with enriched data
        for key, value in enriched_data.items():
            if key != "user_id" and value is not None:
                builder.set(key, value)

        return builder.build()

# Example enrichers
def enrich_from_crm(data: dict) -> dict:
    """Enrich with CRM data"""
    # Simulate CRM lookup
    data["accountValue"] = get_account_value(data.get("user_id"))
    data["industrySegment"] = get_industry_segment(data.get("company"))
    return data

def enrich_from_usage_metrics(data: dict) -> dict:
    """Enrich with usage analytics"""
    # Simulate usage lookup
    data["dailyActiveUse"] = get_daily_active_use(data.get("user_id"))
    data["featureAdoption"] = calculate_feature_adoption(data.get("user_id"))
    return data

def enrich_with_computed_fields(data: dict) -> dict:
    """Add computed attributes"""
    # Calculate derived fields
    if data.get("accountValue") and data.get("dailyActiveUse"):
        data["engagementScore"] = calculate_engagement_score(
            data["accountValue"],
            data["dailyActiveUse"]
        )
    return data

# Usage
pipeline = ContextEnrichmentPipeline()
pipeline.add_enricher(enrich_from_crm) \
        .add_enricher(enrich_from_usage_metrics) \
        .add_enricher(enrich_with_computed_fields)

context = pipeline.enrich({"user_id": "user-123", "company": "TechCorp"})
```

### 5. JWT Claims Integration

Advanced JWT integration with custom claims:

```python
def context_from_jwt_with_custom_claims(jwt_claims: dict, claim_mappings: dict = None):
    """Build context from JWT with custom claim mappings"""

    # Standard claims
    user_id = jwt_claims.get("sub") or jwt_claims.get("user_id")
    if not user_id:
        raise ValueError("No user identifier in JWT")

    builder = Context.builder(user_id)

    # Default claim mappings
    default_mappings = {
        "email": "email",
        "name": "name",
        "given_name": "firstName",
        "family_name": "lastName",
        "preferred_username": "username",
        "locale": "locale",
        "zoneinfo": "timezone",
        # Custom claims
        "org_id": "organizationId",
        "team_id": "teamId",
        "subscription_tier": "tier",
        "permissions": "permissions"
    }

    # Merge with provided mappings
    if claim_mappings:
        default_mappings.update(claim_mappings)

    # Map claims to context
    for claim_key, context_key in default_mappings.items():
        if claim_key in jwt_claims:
            builder.set(context_key, jwt_claims[claim_key])

    # Handle nested custom claims
    if "custom" in jwt_claims:
        for key, value in jwt_claims["custom"].items():
            # Flatten nested structures
            if isinstance(value, dict):
                for nested_key, nested_value in value.items():
                    builder.set(f"{key}_{nested_key}", nested_value)
            else:
                builder.set(key, value)

    # Add JWT metadata
    builder.set("jwtIssuer", jwt_claims.get("iss"))
    builder.set("jwtAudience", jwt_claims.get("aud"))

    return builder.build()
```

### 6. Performance Optimization

Patterns for high-volume context operations:

```python
from functools import lru_cache
from typing import Dict, Optional
import time

class OptimizedContextBuilder:
    """Optimized context building for high-volume scenarios"""

    def __init__(self, cache_size: int = 1000):
        self.cache_size = cache_size
        # Cache computed attributes
        self._compute_cache = {}
        self._cache_timestamps = {}
        self._cache_ttl = 300  # 5 minutes

    @lru_cache(maxsize=1000)
    def _get_cached_computation(self, key: str, value: any) -> any:
        """Cache expensive computations"""
        # This would contain actual computation logic
        return expensive_computation(key, value)

    def build_context_optimized(self, user_id: str, raw_data: dict) -> Context:
        """Build context with caching and optimization"""

        builder = Context.builder(user_id)

        # Batch attribute setting for performance
        attributes = {}

        # Check cache for computed values
        # Note: This cache is process-local, not shared across instances
        import json
        import hashlib
        # Create stable cache key using sorted JSON for consistency
        cache_key = f"{user_id}:{hashlib.md5(json.dumps(raw_data, sort_keys=True).encode()).hexdigest()}"
        now = time.time()

        if cache_key in self._compute_cache:
            cached_time = self._cache_timestamps.get(cache_key, 0)
            if now - cached_time < self._cache_ttl:
                # Use cached computed attributes
                attributes.update(self._compute_cache[cache_key])
            else:
                # Cache expired, recompute
                computed = self._compute_attributes(raw_data)
                self._compute_cache[cache_key] = computed
                self._cache_timestamps[cache_key] = now
                attributes.update(computed)
        else:
            # Compute and cache
            computed = self._compute_attributes(raw_data)
            self._compute_cache[cache_key] = computed
            self._cache_timestamps[cache_key] = now
            attributes.update(computed)

        # Add raw attributes
        for key, value in raw_data.items():
            if key not in attributes and value is not None:
                attributes[key] = value

        # Batch set all attributes
        for key, value in attributes.items():
            builder.set(key, value)

        # Clean cache periodically
        if len(self._compute_cache) > self.cache_size:
            self._clean_cache()

        return builder.build()

    def _compute_attributes(self, raw_data: dict) -> dict:
        """Compute expensive derived attributes"""
        computed = {}

        # Example computations
        if "created_at" in raw_data:
            computed["accountAge"] = calculate_account_age(raw_data["created_at"])
            computed["isNewUser"] = computed["accountAge"] < 30

        if "total_spend" in raw_data:
            computed["valueSegment"] = calculate_value_segment(raw_data["total_spend"])

        return computed

    def _clean_cache(self):
        """Clean expired cache entries"""
        now = time.time()
        expired_keys = [
            key for key, timestamp in self._cache_timestamps.items()
            if now - timestamp > self._cache_ttl
        ]
        for key in expired_keys:
            del self._compute_cache[key]
            del self._cache_timestamps[key]

# Usage for high-volume scenarios
optimizer = OptimizedContextBuilder()

# Process many contexts efficiently
for user_data in large_user_dataset:
    context = optimizer.build_context_optimized(
        user_data["id"],
        user_data
    )
    # Use context...
```

## Cardinality Budget & Safety Rules

**CRITICAL**: Prevent "oops we created 10M contexts" incidents with these rules:

### Never Use as Context Keys
These should NEVER be context keys (use as private attributes instead):
- ❌ Request IDs, trace IDs, conversation IDs
- ❌ Session IDs (use stable user/employee ID as key)
- ❌ Timestamps or dates
- ❌ Raw numeric values (revenue, scores, counts)
- ❌ Dynamic lists or arrays

### Always Bucket Numeric Fields
Transform continuous values into ranges:

```python
# ❌ BAD: Raw numeric value (infinite cardinality)
builder.set("monthlyRevenue", 15234.56)

# ✅ GOOD: Bucketed ranges
def bucket_revenue(revenue: float) -> str:
    if revenue < 1000: return "0-1k"
    elif revenue < 10000: return "1k-10k"
    elif revenue < 100000: return "10k-100k"
    else: return "100k+"

builder.set("revenueRange", bucket_revenue(15234.56))
```

### Handle Lists Safely
For arrays/lists, use one of these patterns:

```python
# ❌ BAD: Raw list (too many combinations)
builder.set("enabledFeatures", ["feat1", "feat2", "feat3"])

# ✅ GOOD: Predefined profiles
feature_profile = get_feature_profile(features)  # returns "core", "pro", "enterprise"
builder.set("featureProfile", feature_profile)

# ✅ GOOD: Individual booleans for key features
builder.set("hasAdvancedReporting", "reporting" in features)
builder.set("hasAPIAccess", "api" in features)
```

### Context Key Guidelines

| Context Kind | Recommended Key Pattern | Cardinality Target |
|-------------|------------------------|-------------------|
| user | Employee/user ID | < 100K |
| organization | Company ID | < 10K |
| agentGraph | Graph name (not version) | < 100 |
| orchestrator | Type + region | < 20 |
| toolchain | Predefined profile | < 10 |
| session | **Use user ID** + session as attribute | Same as user |

## Geographic Context Patterns

Advanced geographic targeting:

```python
def build_geographic_context_advanced(user_id: str, ip_data: dict, preferences: dict = None):
    """Build context with advanced geographic attributes"""

    builder = Context.builder(user_id)

    # Basic geographic data
    builder.set("country", ip_data.get("country_code"))
    builder.set("region", ip_data.get("region"))
    builder.set("city", ip_data.get("city"))
    builder.set("timezone", ip_data.get("timezone"))

    # Advanced geographic attributes
    builder.set("continent", map_to_continent(ip_data.get("country_code")))
    builder.set("marketRegion", map_to_market_region(ip_data.get("country_code")))
    builder.set("dataPrivacyRegion", get_privacy_region(ip_data.get("country_code")))

    # Language and localization
    if preferences:
        builder.set("preferredLanguage", preferences.get("language"))
        builder.set("preferredCurrency", preferences.get("currency"))
    else:
        # Infer from location
        builder.set("inferredLanguage", infer_language(ip_data.get("country_code")))
        builder.set("inferredCurrency", infer_currency(ip_data.get("country_code")))

    # Compliance and regulations
    builder.set("gdprApplies", is_gdpr_country(ip_data.get("country_code")))
    builder.set("ccpaApplies", ip_data.get("region") == "CA" and ip_data.get("country_code") == "US")

    return builder.build()

def get_privacy_region(country_code: str) -> str:
    """Determine data privacy region"""
    eu_countries = ["DE", "FR", "IT", "ES", "NL", "BE", "PL", "SE", "DK", "FI"]
    if country_code in eu_countries:
        return "eu"
    elif country_code == "US":
        return "us"
    elif country_code in ["JP", "KR"]:
        return "apac_strict"
    else:
        return "standard"
```

## Agent Graph Context Patterns

Build contexts for AI agent graphs and workflows:

```python
def build_agent_graph_context(
    graph_id: str,
    node_id: str,
    graph_data: dict,
    node_data: dict
) -> dict:
    """Build context for agent graph execution"""

    # Graph-level context
    graph_context = Context.builder(graph_id).kind("agentGraph")
    graph_context.set("graphVersion", graph_data.get("version", "1.0"))
    graph_context.set("graphStage", graph_data.get("stage", "prod"))  # draft/test/prod
    graph_context.set("graphOwnerTeam", graph_data.get("owner_team"))
    graph_context.set("graphPolicyProfile", graph_data.get("policy", "standard"))
    graph_context.set("graphDomain", graph_data.get("domain"))  # claims/underwriting/etc

    # Node-level context
    node_context = Context.builder(node_id).kind("agentNode")
    node_context.set("nodeType", node_data.get("type"))  # planner/retriever/executor
    node_context.set("nodeDepth", node_data.get("depth", 0))
    node_context.set("parentNodeId", node_data.get("parent_id"))
    node_context.set("nodeCriticality", node_data.get("criticality", "medium"))

    return {
        "graph": graph_context.build(),
        "node": node_context.build()
    }

# Usage
contexts = build_agent_graph_context(
    graph_id="claims-triage-v3",
    node_id="node-retriever-01",
    graph_data={"version": "3.2", "stage": "canary"},
    node_data={"type": "retriever", "depth": 1}
)
```

## Orchestrator & Runtime Context

Capture orchestration engine and runtime characteristics:

```python
def build_orchestrator_context(
    orchestrator_type: str,
    runtime_data: dict
) -> Context:
    """Build context for orchestration runtime"""

    # Use stable orchestrator ID
    orchestrator_id = f"{orchestrator_type}-{runtime_data.get('region', 'default')}"
    builder = Context.builder(orchestrator_id).kind("orchestrator")

    # Core orchestrator attributes
    builder.set("orchestratorType", orchestrator_type)  # langgraph/temporal/custom
    builder.set("orchestratorVersion", runtime_data.get("version"))
    builder.set("executionMode", runtime_data.get("mode", "async"))  # sync/async/streaming

    # Runtime configuration
    builder.set("retryPolicy", runtime_data.get("retry_policy", "standard"))
    builder.set("parallelismEnabled", runtime_data.get("parallel", False))
    builder.set("checkpointing", runtime_data.get("checkpointing", True))
    builder.set("stateBackend", runtime_data.get("state_backend", "memory"))

    # Performance characteristics
    builder.set("timeoutBudgetMs", runtime_data.get("timeout_ms", 30000))
    builder.set("maxRetries", runtime_data.get("max_retries", 3))

    return builder.build()
```

## MCP & Toolchain Context

**Model Context Protocol (MCP)** is an open protocol that enables AI systems to interact with external tools and data sources through natural language. In an agent ecosystem, you may have:
- Multiple MCP servers providing different capabilities (database access, APIs, file systems)
- LaunchDarkly's own MCP server for feature flag management
- Third-party MCP servers from various vendors

**Important**: These context patterns apply to ANY MCP servers attached to your agent system, not just LaunchDarkly's MCP server. Since agents can have many MCP servers, we collapse them into targetable attributes to avoid cardinality explosion.

Handle MCP servers and tool capabilities safely:

```python
def build_mcp_context(
    toolchain_profile: str,  # Use predefined profile as key
    mcp_servers: list,
    tool_policy: str = "standard"
) -> Context:
    """
    Build context for MCP servers and toolchain.

    IMPORTANT: Use a predefined profile as key (not a hash of servers)
    to maintain low cardinality. Store server details as private attributes.
    """

    # Use predefined profile as key (e.g., "claims-basic", "underwriting-advanced")
    builder = Context.builder(toolchain_profile).kind("toolchain")

    # Summary attributes (low cardinality, good for targeting)
    builder.set("mcpEnabled", len(mcp_servers) > 0)
    builder.set("mcpServerCount", categorize_count(len(mcp_servers)))
    builder.set("toolPolicy", tool_policy)

    # Derive capability summary from all servers
    max_risk = "low"
    write_capable = False
    third_party_present = False
    server_ids = []

    for server in mcp_servers:
        server_ids.append(server.get("id"))
        risk = server.get("riskTier", "low")
        if risk_priority(risk) > risk_priority(max_risk):
            max_risk = risk

        if server.get("permissions", "read") in ["write", "admin"]:
            write_capable = True

        if server.get("vendor") not in ["internal", "first_party"]:
            third_party_present = True

    builder.set("maxRiskTier", max_risk)
    builder.set("writeCapable", write_capable)
    builder.set("thirdPartyPresent", third_party_present)

    # Optional: Include server list as private attribute for debugging
    # Private attributes are still sent but not stored in dashboard
    builder.set("mcpServerList", server_ids)
    builder.private("mcpServerList")

    return builder.build()

def categorize_count(count: int) -> str:
    """Bucket counts to avoid high cardinality"""
    if count == 0:
        return "none"
    elif count <= 2:
        return "1-2"
    elif count <= 5:
        return "3-5"
    else:
        return "6+"

def risk_priority(risk: str) -> int:
    """Convert risk tier to priority for comparison"""
    return {"low": 1, "medium": 2, "high": 3, "critical": 4}.get(risk, 0)
```

## Builder Context (Insurance Employees)

Context for insurance employees building and operating agents:

```python
def build_builder_context(
    employee_id: str,
    employee_data: dict,
    compliance_data: dict = None
) -> Context:
    """Build context for insurance employee builders"""

    builder = Context.builder(employee_id).kind("builder")

    # Core employee attributes
    builder.set("builderRole", employee_data.get("role"))  # underwriter/claims_adjuster
    builder.set("department", employee_data.get("department"))
    builder.set("seniority", employee_data.get("seniority", "mid"))
    builder.set("trainingStatus", employee_data.get("training", "trained"))

    # Permissions and access
    builder.set("permissionTier", employee_data.get("permissions", "editor"))
    builder.set("environmentAccess", employee_data.get("env_access", ["dev"]))

    # Compliance and licensing
    if compliance_data:
        builder.set("licenseStates", compliance_data.get("licensed_states", []))
        builder.set("certificationLevel", compliance_data.get("certification"))
        builder.set("complianceTraining", compliance_data.get("compliance_complete"))

    # Feature access controls
    builder.set("canPublishGraphs", employee_data.get("can_publish", False))
    builder.set("canModifyTools", employee_data.get("can_modify_tools", False))
    builder.set("canAccessPii", employee_data.get("pii_access", False))

    return builder.build()
```

## Session & Execution Context

Handle high-cardinality session data carefully:

```python
def build_session_context(
    user_id: str,  # Use stable user ID, not session ID as key
    execution_data: dict,
    anonymous: bool = False
) -> Context:
    """
    Build session/execution context.

    IMPORTANT: Use a stable key (user/employee ID), NOT session ID.
    Session IDs should be attributes, not keys, to avoid cardinality explosion.
    """

    # Use stable user ID as key, add session as attribute
    builder = Context.builder(user_id).kind("session")

    # Set anonymous to exclude from dashboard if needed
    if anonymous:
        builder.anonymous(True)

    # Low-cardinality session attributes
    builder.set("invocationReason", execution_data.get("reason"))  # user/scheduled/retry
    builder.set("attemptNumber", min(execution_data.get("attempt", 1), 3))  # cap at 3
    builder.set("isReplay", execution_data.get("is_replay", False))
    builder.set("debugMode", execution_data.get("debug", False))

    # High-cardinality identifiers as private attributes
    if execution_data.get("session_id"):
        builder.set("sessionId", execution_data.get("session_id"))
        builder.private("sessionId")

    if execution_data.get("conversation_id"):
        builder.set("conversationId", execution_data.get("conversation_id"))
        builder.private("conversationId")

    if execution_data.get("request_id"):
        builder.set("requestId", execution_data.get("request_id"))
        builder.private("requestId")

    if execution_data.get("trace_id"):
        builder.set("traceId", execution_data.get("trace_id"))
        builder.private("traceId")

    return builder.build()
```

## Complete Multi-Context Example

Bringing it all together for agent graph execution:

```python
def build_complete_agent_context(
    user_id: str,
    org_id: str,
    graph_id: str,
    node_id: str,
    mcp_servers: list,
    session_id: str
) -> Context:
    """Build complete multi-context for agent evaluation"""

    multi_builder = Context.multi_builder()

    # 1. User context (insurance employee)
    user_context = Context.builder(user_id).kind("user")
    user_context.set("role", "claims_adjuster")
    user_context.set("department", "claims")
    user_context.set("tier", "professional")
    multi_builder.add(user_context.build())

    # 2. Organization context
    org_context = Context.builder(org_id).kind("organization")
    org_context.set("industry", "insurance")
    org_context.set("complianceTier", "high")
    org_context.set("dataResidency", "us-west")
    multi_builder.add(org_context.build())

    # 3. Agent graph context
    graph_context = Context.builder(graph_id).kind("agentGraph")
    graph_context.set("graphVersion", "2.1")
    graph_context.set("nodeId", node_id)
    graph_context.set("nodeType", "retriever")
    multi_builder.add(graph_context.build())

    # 4. Orchestrator context
    orch_context = Context.builder("orch-prod-west").kind("orchestrator")
    orch_context.set("orchestratorType", "langgraph")
    orch_context.set("executionMode", "async")
    multi_builder.add(orch_context.build())

    # 5. MCP/Toolchain context (use predefined profile)
    toolchain_profile = "claims-standard"  # Predefined profile, not dynamic
    toolchain_context = build_mcp_context(toolchain_profile, mcp_servers, "strict")
    multi_builder.add(toolchain_context)

    # 6. Session context (use user ID as key, session ID as attribute)
    session_context = Context.builder(user_id).kind("session")
    session_context.set("sessionId", session_id)
    session_context.private("sessionId")  # Mark attribute as private
    session_context.set("invocationReason", "user_action")
    multi_builder.add(session_context.build())

    return multi_builder.build()

# Usage
context = build_complete_agent_context(
    user_id="emp-123",
    org_id="carrier-456",
    graph_id="claims-triage",
    node_id="node-01",
    mcp_servers=[
        {"id": "mcp-claims-db", "vendor": "internal", "riskTier": "medium"},
        {"id": "mcp-docs", "vendor": "internal", "riskTier": "low"}
    ],
    session_id="sess-789"
)

# Evaluate AI Config with this context
config = ai_client.completion_config(
    "claims-assistant",
    context,
    default_config
)
```

## Context Factory Patterns

Reusable context factories for common scenarios:

```python
class ContextFactory:
    """Factory for creating standardized contexts"""

    @staticmethod
    def create_retail_customer(customer_data: dict) -> Context:
        """Create context for retail/e-commerce"""
        builder = Context.builder(customer_data["id"])

        # Customer attributes
        builder.set("customerType", customer_data.get("type", "regular"))
        builder.set("lifetimeValue", customer_data.get("ltv", 0))
        builder.set("purchaseFrequency", customer_data.get("purchase_frequency"))
        builder.set("cartAbandonment", customer_data.get("cart_abandonment_rate"))
        builder.set("preferredCategories", customer_data.get("categories", []))
        builder.set("loyaltyTier", customer_data.get("loyalty_tier", "bronze"))

        # Behavioral attributes
        builder.set("lastPurchaseDays", customer_data.get("days_since_purchase"))
        builder.set("avgOrderValue", customer_data.get("aov"))
        builder.set("returnRate", customer_data.get("return_rate"))

        return builder.build()

    @staticmethod
    def create_saas_user(user_data: dict, account_data: dict) -> Context:
        """Create context for SaaS applications"""
        builder = Context.builder(user_data["id"])

        # User attributes
        builder.set("role", user_data.get("role"))
        builder.set("onboardingCompleted", user_data.get("onboarding_complete"))
        builder.set("lastLogin", user_data.get("last_login"))

        # Account attributes
        builder.set("accountId", account_data.get("id"))
        builder.set("plan", account_data.get("plan"))
        builder.set("mrr", account_data.get("monthly_revenue"))
        builder.set("churnRisk", account_data.get("churn_risk_score"))
        builder.set("healthScore", account_data.get("health_score"))
        builder.set("contractEndDate", account_data.get("contract_end"))

        # Usage attributes
        builder.set("activeUsers", account_data.get("active_user_count"))
        builder.set("storageUsed", account_data.get("storage_gb"))
        builder.set("apiCalls", account_data.get("api_calls_month"))

        return builder.build()

# Usage
retail_context = ContextFactory.create_retail_customer({
    "id": "customer-123",
    "type": "vip",
    "ltv": 5000,
    "loyalty_tier": "platinum"
})

saas_context = ContextFactory.create_saas_user(
    {"id": "user-456", "role": "admin"},
    {"id": "account-789", "plan": "enterprise", "mrr": 10000}
)
```

## Comprehensive Attribute Reference

<details>
<summary>📚 Comprehensive Attribute Reference (Partner Integration Guide)</summary>

*This exhaustive list is provided for partners building integrations. Most implementations only need 5-10 attributes.*

**Quick Jump:**
- [User Attributes](#user-attributes) - Personal information
- [Behavioral Attributes](#behavioral-attributes) - Usage patterns
- [Business Attributes](#business-attributes) - B2B context
- [Technical Attributes](#technical-attributes) - Device/platform
- [Geographic Attributes](#geographic-attributes) - Location data
- [Temporal Attributes](#temporal-attributes) - Time-based
- [Experimental Attributes](#experimental-attributes) - A/B testing
- [Agent Graph Attributes](#agent-graph-attributes) - Agent workflow context
- [Orchestrator Attributes](#orchestrator-attributes) - Runtime engine context
- [MCP/Toolchain Attributes](#mcptoolchain-attributes) - Tool capabilities
- [Builder Attributes](#builder-attributes) - Insurance employee context
- [Session Attributes](#session-attributes) - Execution context

### User Attributes

| Attribute | Type | Common Use |
|-----------|------|------------|
| `email` | string | User identification |
| `name` | string | Personalization in prompts |
| `firstName` | string | Personalization |
| `lastName` | string | Personalization |
| `username` | string | Display purposes |
| `tier` | string | Model selection, feature gating |
| `role` | string | Role-based prompts |
| `department` | string | Department-specific AI behavior |
| `cohort` | string | User grouping and segmentation |
| `accountAge` | number | Experience-based targeting |
| `language` | string | Localization |
| `timezone` | string | Time-aware responses |

### Behavioral Attributes

| Attribute | Type | Common Use |
|-----------|------|------------|
| `usageLevel` | string | Resource allocation |
| `lastActivity` | string/number | Engagement targeting |
| `sessionCount` | number | Experience level detection |
| `featureUsage` | array | Feature-specific targeting |
| `apiCalls` | number | Rate limiting, tier enforcement |
| `dailyActiveUse` | boolean | Engagement metrics |
| `churnRisk` | number | Retention targeting |
| `engagementScore` | number | User value assessment |

### Business Attributes

| Attribute | Type | Common Use |
|-----------|------|------------|
| `companyName` | string | B2B personalization |
| `companySize` | string | Enterprise features |
| `industry` | string | Industry-specific prompts |
| `plan` | string | Feature gating |
| `mrr` | number | Value-based targeting |
| `contractValue` | number | Priority support |
| `seats` | number | License enforcement |
| `accountId` | string | Account-level targeting |

### Technical Attributes

| Attribute | Type | Common Use |
|-----------|------|------------|
| `deviceType` | string | Device-specific UI |
| `browser` | string | Compatibility checks |
| `os` | string | Platform-specific features |
| `appVersion` | string | Version-specific behavior |
| `sdkVersion` | string | SDK compatibility |
| `ip` | string | Geographic inference |

### Geographic Attributes

| Attribute | Type | Common Use |
|-----------|------|------------|
| `country` | string | Localization, compliance |
| `region` | string | Regional features |
| `city` | string | Local personalization |
| `marketRegion` | string | Market-specific features |
| `dataCenter` | string | Latency optimization |
| `gdprApplies` | boolean | Privacy compliance |

### Temporal Attributes

| Attribute | Type | Common Use |
|-----------|------|------------|
| `signupDate` | string/number | Cohort analysis |
| `lastLoginDate` | string/number | Engagement tracking |
| `trialEndDate` | string/number | Conversion targeting |
| `renewalDate` | string/number | Retention campaigns |
| `hourOfDay` | number | Time-based behavior |
| `dayOfWeek` | string | Usage patterns |

### Experimental Attributes

| Attribute | Type | Common Use |
|-----------|------|------------|
| `experimentBucket` | number | Random assignment |
| `testGroup` | string | A/B test assignment |
| `cohortWeek` | number | Time-based cohorts |
| `betaTester` | boolean | Early access |
| `featureFlags` | object | Feature toggles |

### Agent Graph Attributes

Context for agent workflows and graph execution:

| Attribute | Type | Required | Common Use | Notes |
|-----------|------|----------|------------|-------|
| **`key`*** | string | Yes | Graph identifier | Unique ID like "claims-triage-v3" |
| `graphVersion` | string | | Version control | Semantic version (1.0, 2.1) |
| `graphStage` | string | | Deployment stage | draft/test/canary/prod |
| `graphOwnerTeam` | string | | Ownership tracking | Team responsible for graph |
| `graphPolicyProfile` | string | | Risk management | standard/restricted/elevated |
| `graphDomain` | string | | Business domain | claims/underwriting/billing |
| `nodeId` | string | | Current node | For node-level targeting |
| `nodeType` | string | | Node capability | planner/retriever/executor/validator |
| `nodeDepth` | number | | Graph traversal depth | 0-based depth in execution |
| `parentNodeId` | string | | Node hierarchy | Parent in execution tree |
| `nodeCriticality` | string | | Impact assessment | low/medium/high/critical |
| `graphComplexity` | string | | Resource planning | simple/moderate/complex |
| `graphTags` | array | | Categorization | ["financial", "pii", "regulated"] |

### Orchestrator Attributes

Runtime engine and execution environment:

| Attribute | Type | Required | Common Use | Notes |
|-----------|------|----------|------------|-------|
| **`key`*** | string | Yes | Orchestrator ID | Like "langgraph-prod-west" |
| `orchestratorType` | string | | Engine type | langgraph/temporal/custom/stepfunctions |
| `orchestratorVersion` | string | | Version tracking | Engine version number |
| `executionMode` | string | | Processing mode | sync/async/streaming/batch |
| `retryPolicy` | string | | Error handling | none/standard/aggressive/custom |
| `parallelismEnabled` | boolean | | Concurrency | Whether parallel execution allowed |
| `checkpointing` | boolean | | State management | Whether state is persisted |
| `stateBackend` | string | | Storage type | memory/redis/dynamodb/postgres |
| `timeoutBudgetMs` | number | | Time constraints | Max execution time in ms |
| `maxRetries` | number | | Resilience | Maximum retry attempts |
| `region` | string | | Geographic location | Deployment region |
| `environment` | string | | Deployment env | dev/staging/prod |
| `resourceTier` | string | | Resource allocation | basic/standard/premium |

### MCP/Toolchain Attributes

Tool capabilities and boundaries (collapsed from server list):

| Attribute | Type | Required | Common Use | Notes |
|-----------|------|----------|------------|-------|
| **`key`*** | string | Yes | Toolchain Profile | Predefined profile (e.g., "claims-standard") |
| `mcpEnabled` | boolean | | MCP presence | Whether any MCP servers attached |
| `mcpServerCount` | string | | Server quantity | none/1-2/3-5/6+ (bucketed) |
| `toolPolicy` | string | | Access policy | standard/strict/permissive |
| `maxRiskTier` | string | | Highest risk | low/medium/high/critical |
| `writeCapable` | boolean | | Write permissions | Can modify external systems |
| `thirdPartyPresent` | boolean | | Vendor risk | Non-internal servers present |
| `toolCategories` | array | | Capability types | ["database", "api", "filesystem"] |
| `dataSourceTypes` | array | | Data access | ["sql", "nosql", "files", "apis"] |
| `complianceLevel` | string | | Regulatory | none/basic/sox/hipaa/pci |
| `auditingEnabled` | boolean | | Tracking | Whether actions are logged |
| `mcpServerList` | array | Private | Debug info | Actual server IDs (high cardinality) |

### Builder Attributes

Insurance employee building agents:

| Attribute | Type | Required | Common Use | Notes |
|-----------|------|----------|------------|-------|
| **`key`*** | string | Yes | Employee ID | Unique identifier |
| `builderRole` | string | | Job function | underwriter/claims_adjuster/actuarial |
| `department` | string | | Org structure | claims/underwriting/risk/operations |
| `seniority` | string | | Experience level | junior/mid/senior/principal |
| `trainingStatus` | string | | Qualification | untrained/in_progress/trained/certified |
| `permissionTier` | string | | Access level | viewer/editor/publisher/admin |
| `environmentAccess` | array | | Allowed envs | ["dev", "test", "staging"] |
| `licenseStates` | array | | Geographic auth | ["CA", "TX", "NY"] for US |
| `certificationLevel` | string | | Professional cert | none/basic/advanced/expert |
| `complianceTraining` | boolean | | Regulatory | Completed required training |
| `canPublishGraphs` | boolean | | Publishing rights | Can push to production |
| `canModifyTools` | boolean | | Tool management | Can add/remove MCP servers |
| `canAccessPii` | boolean | | Data access | PII handling permission |
| `teamSize` | number | | Team scope | Number of direct reports |
| `yearsExperience` | number | | Tenure | Years in role/industry |

### Session Attributes

Execution and request context:

| Attribute | Type | Required | Common Use | Notes |
|-----------|------|----------|------------|-------|
| **`key`*** | string | Yes | User/Employee ID | Use stable ID, NOT session ID |
| `sessionId` | string | Private | Session tracking | High cardinality, mark private |
| `invocationReason` | string | | Trigger type | user/scheduled/retry/webhook |
| `attemptNumber` | number | | Retry count | Capped at 3 to avoid cardinality |
| `isReplay` | boolean | | Execution type | Whether replaying previous |
| `debugMode` | boolean | | Logging level | Enhanced logging enabled |
| `priority` | string | | Queue priority | low/normal/high/critical |
| `workflowId` | string | Private | Workflow tracking | High cardinality ID |
| `conversationId` | string | Private | Chat thread | High cardinality ID |
| `requestId` | string | Private | Request tracking | Unique per request |
| `traceId` | string | Private | Distributed trace | Cross-service correlation |
| `parentSpanId` | string | Private | Trace hierarchy | Parent in trace tree |
| `batchId` | string | | Batch processing | Group of related requests |
| `userAction` | string | | User intent | click/submit/refresh/navigate |

### Using Attributes Effectively

**For Targeting (`aiconfig-targeting`):**
- Use `tier`, `plan`, `role`, `region` for rule-based targeting
- Combine multiple attributes for complex rules
- Use numeric attributes with comparison operators
- Target by `graphStage` for canary deployments
- Use `maxRiskTier` to limit high-risk operations
- Filter by `builderRole` for role-based access

**For Segmentation (`aiconfig-segments`):**
- Use `cohort`, `testGroup` for grouping users
- Include `experimentBucket` for random assignment
- Track `signupDate`, `accountAge` for cohort analysis
- Group by `orchestratorType` for runtime comparisons
- Segment by `graphDomain` for business unit analysis

**For Personalization (`aiconfig-variations`):**
- Use in messages: `{{ ldctx.name }}`, `{{ ldctx.company }}`
- Combine attributes: `{{ ldctx.firstName }} from {{ ldctx.companyName }}`
- Conditional content based on attributes
- Adjust prompts by `builderRole` and `department`
- Modify instructions based on `complianceLevel`

**For Metrics (`aiconfig-ai-metrics`):**
- Segment by `tier`, `plan`, `usageLevel`
- Track performance by `region`, `deviceType`
- Analyze by `cohort`, `experimentBucket`
- Compare `orchestratorType` performance
- Monitor costs by `graphComplexity`
- Track errors by `nodeType` and `nodeCriticality`

**For Experiments (A/B Testing):**
- Randomize on stable IDs (`user.key`, `organization.key`)
- Use `graphVersion` for version testing
- Compare `orchestratorType` variations
- Test different `retryPolicy` settings
- Experiment with `parallelismEnabled` toggles

**For Risk Management:**
- Restrict by `maxRiskTier` and `writeCapable`
- Gate features by `certificationLevel`
- Limit `canAccessPii` for sensitive data
- Control `canPublishGraphs` for production access
- Monitor `thirdPartyPresent` for vendor risk

**Private Attributes (High Cardinality):**
- Mark session IDs, request IDs, trace IDs as private
- Keep `mcpServerList` private to avoid cardinality explosion
- Private attributes can still be used for targeting but won't appear in UI
- Use bucketed/categorized versions for public attributes

</details>

## Best Practices

1. **Context Enrichment Strategy**
   - Enrich progressively, not all at once
   - Cache expensive computations
   - Use async enrichment for external data

2. **Multi-Context Guidelines**
   - Keep context kinds focused (user, org, workspace)
   - Don't duplicate attributes across contexts
   - Use for true multi-entity scenarios

3. **Performance Optimization**
   - Minimize attribute count
   - Use caching for repeated builds
   - Batch operations when possible

4. **Data Privacy**
   - Never use PII as context keys
   - Hash sensitive data
   - Respect regional privacy laws

## Related Skills

### Prerequisites
- `aiconfig-context-basic` - Master basic contexts first
- `aiconfig-sdk` - SDK context implementation
- `aiconfig-targeting` - Targeting with contexts

### Framework Integration
- `aiconfig-frameworks` - Use contexts with orchestrators
- `aiconfig-experiments` - Multi-context experiments
- `aiconfig-segments` - Create segments from contexts

### Monitoring
- `aiconfig-ai-metrics` - Track by context attributes
- `aiconfig-custom-metrics` - Custom metrics by context
- `aiconfig-online-evals` - Quality by context
## References

- [Multi-contexts Documentation](https://docs.launchdarkly.com/home/flags/multi-contexts)
- [Context Kinds](https://docs.launchdarkly.com/home/flags/context-kinds)
- [Advanced Targeting](https://docs.launchdarkly.com/home/flags/target)
- [Python AI SDK](https://docs.launchdarkly.com/sdk/ai/python)