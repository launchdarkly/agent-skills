---
name: aiconfig-projects
description: Guide for setting up LaunchDarkly projects in your codebase. Helps you assess your stack, choose the right approach, and integrate project management that makes sense for your architecture.
compatibility: Requires LaunchDarkly API access token with projects:write permission or LaunchDarkly MCP server.
metadata:
  author: launchdarkly
  version: "0.4.0"
---

# LaunchDarkly Projects Setup

A workflow for integrating LaunchDarkly project management into your codebase. This skill helps you explore your stack, assess your needs, and choose the right implementation approach.

## Prerequisites

**Choose one:**
- LaunchDarkly API access token with `projects:write` permission
- LaunchDarkly MCP server configured in your environment

## Core Principles

1. **Understand First**: Explore the codebase to understand the stack and patterns.
2. **Choose the Right Fit**: Select an approach that matches your architecture.
3. **Follow Conventions**: Respect existing code style and structure.
4. **Verify Integration**: Confirm the setup works in your environment.

## What Are Projects?

Projects are LaunchDarkly's top-level organizational containers that hold:
- All your AI Configs
- Feature flags and segments  
- Multiple environments (Production and Test created by default)

Think of projects as separate applications, services, or teams that need their own isolated set of configurations.

## Project Setup Workflow

### Step 1: Explore the Codebase

Before implementing anything, understand the existing architecture:

1. **Identify the tech stack:**
   - What language(s)? (Python, Node.js, Go, Java, etc.)
   - What framework(s)? (FastAPI, Express, Spring Boot, etc.)
   - Is there an existing LaunchDarkly integration?

2. **Check environment management:**
   - How are environment variables stored? (.env files, secrets manager, config files)
   - Where is configuration loaded? (startup scripts, config modules)
   - Are there existing LaunchDarkly SDK keys?

3. **Look for patterns:**
   - Are there existing API clients or service modules?
   - How is external API integration typically done?
   - Is there a CLI, scripts directory, or admin tooling?

4. **Understand the use case:**
   - Is this a new project being set up?
   - Adding to an existing LaunchDarkly integration?
   - Part of a multi-service architecture?
   - Need for project cloning across regions/teams?

### Step 2: Assess the Situation

Based on your exploration, determine the right approach:

| Scenario | Recommended Path |
|----------|------------------|
| New project, no LaunchDarkly integration | **Quick Setup** - Create project and save SDK keys |
| Existing LaunchDarkly usage | **Add to Existing** - Create new project or use existing |
| Multiple services/microservices | **Multi-Project** - Create projects per service |
| Multi-region or multi-tenant | **Project Cloning** - Clone template project |
| Infrastructure-as-Code (IaC) setup | **Automated Setup** - Script-based creation |
| Need project management tooling | **CLI/Admin Tools** - Build project management utilities |

### Step 3: Choose Your Implementation Path

Select the reference guide that matches your stack and use case:

**By Language/Stack:**
- [Python Implementation](references/python-setup.md) - For Python applications (FastAPI, Django, Flask)
- [Node.js/TypeScript Implementation](references/nodejs-setup.md) - For Node.js/Express/NestJS applications
- [Go Implementation](references/go-setup.md) - For Go services
- [Multi-Language Setup](references/multi-language-setup.md) - For polyglot architectures

**By Use Case:**
- [Quick Start](references/quick-start.md) - Create first project and get SDK keys
- [Environment Configuration](references/env-config.md) - Save SDK keys to .env, secrets, or config
- [Project Cloning](references/project-cloning.md) - Clone projects for regions/teams
- [IaC/Automation](references/iac-automation.md) - Terraform, scripts, CI/CD integration
- [Admin Tooling](references/admin-tooling.md) - Build CLI or admin utilities

### Step 4: Implement the Integration

Follow the chosen reference guide to implement project management. Key considerations:

1. **API Authentication:**
   - Store API token securely
   - Follow existing secrets management patterns
   - Never commit tokens to version control

2. **Project Naming:**
   - Use consistent, descriptive names
   - Follow existing naming conventions
   - Project keys: lowercase, hyphens, start with letter

3. **SDK Key Management:**
   - Extract and store SDK keys for each environment
   - Use the same pattern as other secrets in your codebase
   - Consider separate keys for test/staging/production

4. **Error Handling:**
   - Handle existing projects gracefully (409 conflict)
   - Provide clear error messages
   - Don't fail silently

### Step 5: Verify the Setup

Confirm everything works:

1. **Verify Project Creation:**
   - Project exists in LaunchDarkly UI
   - Default environments (production, test) are present
   - Tags and metadata are correct

2. **Verify SDK Keys:**
   - SDK keys are saved to correct location
   - Application can load the keys
   - Keys work with LaunchDarkly SDK

3. **Test Integration:**
   - Can create AI Configs in the project
   - Can fetch configs using SDK key
   - Environment separation works correctly

## Project Key Best Practices

Project keys must follow these rules:

```
✓ Good examples:
  - "support-ai"
  - "chat-bot-v2"
  - "internal-tools"

✗ Bad examples:
  - "Support_AI"     # No uppercase or underscores
  - "123-project"    # Must start with letter  
  - "my.project"     # No dots allowed
```

**Naming Recommendations:**
- Keep keys short but descriptive
- Use team/service/purpose as naming scheme
- Be consistent across your organization

## Common Organization Patterns

### By Team
```
platform-ai       → Platform Team AI
customer-ai       → Customer Success Team AI
internal-ai       → Internal Tools Team AI
```

### By Application/Service
```
mobile-ai         → Mobile App AI Configs
web-ai            → Web App AI Configs
api-ai            → API Service AI Configs
```

### By Region/Deployment
```
ai-us             → US Region
ai-eu             → Europe Region
ai-apac           → Asia-Pacific Region
```

## Edge Cases

| Situation | Action |
|-----------|--------|
| Project already exists | Check if it's the right one; use it or create with different key |
| Need multiple projects | Create separately for each service/region/team |
| Shared configs across services | Use same project, separate by SDK context |
| Token lacks permissions | Request `projects:write` or use MCP server |
| Project name conflict | Keys must be unique, names can be similar |

## What NOT to Do

- Don't create projects without understanding the use case first
- Don't commit API tokens or SDK keys to version control
- Don't use production SDK keys in test/development environments
- Don't create duplicate projects unnecessarily
- Don't skip the exploration phase

## Next Steps

After setting up projects:

1. **Create AI Configs** - Use the `aiconfig-create` skill
2. **Set up SDK Integration** - Use the `aiconfig-sdk` skill
3. **Configure Targeting** - Use the `aiconfig-targeting` skill

## Related Skills

- `aiconfig-create` - Create AI Configs in projects
- `aiconfig-sdk` - Integrate SDK in your application
- `aiconfig-targeting` - Configure AI Config targeting
- `aiconfig-variations` - Manage config variations

## References

- [Python Implementation](references/python-setup.md)
- [Node.js Implementation](references/nodejs-setup.md)
- [Go Implementation](references/go-setup.md)
- [Quick Start Guide](references/quick-start.md)
- [Environment Configuration](references/env-config.md)
- [Project Cloning](references/project-cloning.md)
- [IaC/Automation](references/iac-automation.md)
- [Admin Tooling](references/admin-tooling.md)
