---
name: aiconfig-projects
description: Create LaunchDarkly projects to organize your AI Configs. Projects are containers that hold AI Configs, feature flags, and segments.
compatibility: Requires LaunchDarkly API access token with projects:write permission.
metadata:
  author: launchdarkly
  version: "0.3.0"
---

# LaunchDarkly Projects for AI Configs

Create and manage projects to organize your AI Configs. Projects are the top-level containers in LaunchDarkly.

## Prerequisites

- LaunchDarkly API access token with `projects:write` permission
- Python 3.8+

## What Are Projects?

Projects are containers that hold:
- All your AI Configs
- Feature flags and segments
- Multiple environments (Production and Test are created by default)

Think of projects as separate applications or services that need their own set of AI Configs.

## Quick Start

```python
import requests
import os

API_TOKEN = os.environ.get("LAUNCHDARKLY_API_TOKEN")
BASE_URL = "https://app.launchdarkly.com/api/v2"

def create_project(name: str, key: str):
    """
    Create a new LaunchDarkly project for your AI Configs.

    Args:
        name: Human-readable project name (e.g., "Customer Support AI")
        key: Unique identifier, lowercase with hyphens (e.g., "support-ai")

    Returns:
        Created project with SDK keys, or existing project if already exists
    """
    url = f"{BASE_URL}/projects"
    headers = {
        "Authorization": API_TOKEN,
        "Content-Type": "application/json"
    }
    payload = {
        "name": name,
        "key": key,
        "tags": ["ai-configs"]
    }

    response = requests.post(url, headers=headers, json=payload)

    if response.status_code == 201:
        project = response.json()
        print(f"[OK] Project '{name}' created successfully!")
        _print_sdk_keys(project)
        return project
    elif response.status_code == 409:
        print(f"[INFO] Project '{key}' already exists")
        return get_project(key)
    else:
        print(f"[ERROR] Failed to create project: {response.text}")
        return None


def get_project(project_key: str):
    """Get an existing project with its SDK keys."""
    url = f"{BASE_URL}/projects/{project_key}"
    headers = {"Authorization": API_TOKEN}
    params = {"expand": "environments"}

    response = requests.get(url, headers=headers, params=params)

    if response.status_code == 200:
        project = response.json()
        print(f"[PROJECT] {project['name']} ({project['key']})")
        _print_sdk_keys(project)
        return project
    else:
        print(f"[ERROR] Project not found")
        return None


def _get_environments(project: dict) -> list:
    """Extract environments list from project (handles both API formats)."""
    envs = project.get("environments", {})
    if isinstance(envs, dict):
        return envs.get("items", [])
    return envs


def _print_sdk_keys(project: dict):
    """Print SDK keys for all environments."""
    for env in _get_environments(project):
        print(f"\n{env['name']} Environment:")
        print(f"  SDK Key: {env['apiKey']}")


def get_sdk_key(project_key: str, environment: str = "production") -> str:
    """
    Get the SDK key for a specific environment.

    Args:
        project_key: The project key
        environment: Environment name (default: "production")

    Returns:
        The SDK key string, or None if not found
    """
    url = f"{BASE_URL}/projects/{project_key}"
    headers = {"Authorization": API_TOKEN}
    params = {"expand": "environments"}

    response = requests.get(url, headers=headers, params=params)

    if response.status_code != 200:
        print(f"[ERROR] Project not found")
        return None

    project = response.json()
    for env in _get_environments(project):
        if env["key"] == environment:
            return env["apiKey"]

    print(f"[ERROR] Environment '{environment}' not found")
    return None


def list_projects():
    """List all projects in your organization."""
    url = f"{BASE_URL}/projects"
    headers = {"Authorization": API_TOKEN}

    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        projects = response.json().get("items", [])
        print(f"[PROJECTS] Found {len(projects)} projects:\n")

        for project in projects:
            print(f"  - {project['name']} ({project['key']})")
            tags = ', '.join(project.get('tags', [])) or 'none'
            print(f"    Tags: {tags}")

        return projects
    else:
        print(f"[ERROR] Failed to list projects")
        return []


def delete_project(project_key: str):
    """
    Delete a project. Warning: This deletes all configs, flags, and segments in the project.

    Args:
        project_key: The project key to delete

    Returns:
        True if deleted, False otherwise
    """
    url = f"{BASE_URL}/projects/{project_key}"
    headers = {"Authorization": API_TOKEN}

    response = requests.delete(url, headers=headers)

    if response.status_code == 204:
        print(f"[OK] Deleted project: {project_key}")
        return True
    elif response.status_code == 404:
        print(f"[INFO] Project '{project_key}' does not exist")
        return False
    else:
        print(f"[ERROR] Failed to delete project: {response.text}")
        return False


# Example usage
project = create_project(
    name="Customer Support AI",
    key="support-ai"
)

# Get SDK key for your application
sdk_key = get_sdk_key("support-ai", "production")
print(f"\n[SDK] Use this SDK key in your application: {sdk_key}")
```

## Save SDK Key to .env File

Automatically save your SDK key to a `.env` file for use in your application:

```python
def save_sdk_key_to_env(
    project_key: str,
    environment: str = "production",
    env_file: str = ".env",
    var_name: str = "LAUNCHDARKLY_SDK_KEY"
):
    """
    Extract SDK key from project and save to .env file.

    Args:
        project_key: The project key
        environment: Environment to get key for (default: "production")
        env_file: Path to .env file (default: ".env")
        var_name: Environment variable name (default: "LAUNCHDARKLY_SDK_KEY")
    """
    sdk_key = get_sdk_key(project_key, environment)

    if not sdk_key:
        print(f"[ERROR] Could not get SDK key for {project_key}/{environment}")
        return False

    # Read existing .env content
    env_content = {}
    try:
        with open(env_file, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    env_content[key] = value
    except FileNotFoundError:
        pass  # File doesn't exist yet

    # Update or add the SDK key
    env_content[var_name] = sdk_key

    # Write back to .env
    with open(env_file, "w") as f:
        for key, value in env_content.items():
            f.write(f"{key}={value}\n")

    print(f"[OK] Saved SDK key to {env_file}")
    print(f"   {var_name}={sdk_key[:10]}...{sdk_key[-4:]}")
    return True

# Example: Save production SDK key
save_sdk_key_to_env("support-ai", "production")

# Example: Save test environment key with custom variable name
save_sdk_key_to_env("support-ai", "test", var_name="LAUNCHDARKLY_SDK_KEY_TEST")
```

## Clone a Project

When you need to create a similar project (e.g., for a different region or team):

```python
def clone_project(source_key: str, new_name: str, new_key: str):
    """
    Clone an existing project's structure to create a new one.

    Args:
        source_key: The project to copy from
        new_name: Name for the new project
        new_key: Unique key for the new project

    Returns:
        The newly created project
    """
    headers = {
        "Authorization": API_TOKEN,
        "Content-Type": "application/json"
    }

    # Get the source project
    source_resp = requests.get(f"{BASE_URL}/projects/{source_key}", headers=headers)

    if source_resp.status_code != 200:
        print(f"[ERROR] Source project '{source_key}' not found")
        return None

    source = source_resp.json()

    # Create new project with same settings
    payload = {
        "name": new_name,
        "key": new_key,
        "tags": source.get("tags", []) + ["cloned"],
        "includeInSnippetByDefault": source.get("includeInSnippetByDefault", True)
    }

    response = requests.post(f"{BASE_URL}/projects", headers=headers, json=payload)

    if response.status_code == 201:
        project = response.json()
        print(f"[OK] Cloned '{source_key}' -> '{new_key}'")
        _print_sdk_keys(project)
        return project
    else:
        print(f"[ERROR] Failed to clone: {response.text}")
        return None

# Example: Create a regional variant
# clone_project(
#     source_key="support-ai",
#     new_name="Customer Support AI - Europe",
#     new_key="support-ai-eu"
# )
```

## Project Keys Best Practice

Project keys must be:
- Lowercase letters, numbers, and hyphens only
- Start with a letter
- Unique across your organization

```python
# Good examples:
"support-ai"
"chat-bot-v2"
"internal-tools"

# Bad examples:
"Support_AI"     # No uppercase or underscores
"123-project"    # Must start with letter
"my.project"     # No dots allowed
```

## Common Patterns

### Projects by Team
```python
create_project("Platform AI", "platform-ai")
create_project("Customer AI", "customer-ai")
create_project("Internal Tools AI", "internal-ai")
```

### Projects by Application
```python
create_project("Mobile App AI", "mobile-ai")
create_project("Web App AI", "web-ai")
create_project("API Services AI", "api-ai")
```

### Projects by Region
```python
create_project("AI Services - US", "ai-us")
clone_project("ai-us", "AI Services - EU", "ai-eu")
clone_project("ai-us", "AI Services - APAC", "ai-apac")
```

## Next Steps

After creating a project:

1. **Save your SDK keys** - You'll need them to connect your application
2. **Create AI Configs** - Use the `aiconfig-create` skill
3. **Set up targeting** - Use the `aiconfig-targeting` skill

## Related Skills

- `aiconfig-create` - Create AI Configs in projects
- `aiconfig-api` - API patterns and authentication
- `aiconfig-sdk` - Use project configs in code
- `aiconfig-variations` - Manage config variations
- `aiconfig-segments` - Create user segments

## References

- [Projects Documentation](https://docs.launchdarkly.com/home/organize/projects)
- [Projects API](https://apidocs.launchdarkly.com/tag/Projects/)
