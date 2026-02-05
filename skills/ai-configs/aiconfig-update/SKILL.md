---
name: aiconfig-update
description: Update and delete LaunchDarkly AI Configs. Learn how to modify existing AI Configs and manage their lifecycle.
compatibility: Requires LaunchDarkly project with AI Configs enabled and API access token.
metadata:
  author: launchdarkly
  version: "0.1.0"
---

# AI Config Update and Delete Operations

Update existing LaunchDarkly AI Configs and manage their lifecycle. This skill covers updating config properties, archiving configs, and deleting them when no longer needed.

## Prerequisites

- LaunchDarkly project with AI Configs enabled
- API access token with write permissions
- Existing AI Config to update or delete

> **Note:** The LaunchDarkly MCP server has `update-ai-config` and `delete-ai-config` tools for basic operations. Use the REST API below for full functionality. See `aiconfig-api` for details.

## Core Concepts

AI Config lifecycle management includes:
- **Updating**: Modify name, description, and other properties
- **Archiving**: Temporarily disable configs while preserving data
- **Deleting**: Permanently remove configs (cannot be undone)

## Update AI Config

Update an existing AI Config's properties using a PATCH request:

```python
import requests
import json

# Configuration
API_TOKEN = "your-api-token"
PROJECT_KEY = "your-project"
CONFIG_KEY = "your-config-key"

# Update config properties
url = f"https://app.launchdarkly.com/api/v2/projects/{PROJECT_KEY}/ai-configs/{CONFIG_KEY}"

headers = {
    "Authorization": f"{API_TOKEN}",
    "Content-Type": "application/json"
}

# Update data - simple object with fields to update
patch_data = {
    "name": "Updated AI Config Name",
    "description": "Updated description for the AI Config"
}

response = requests.patch(url, headers=headers, json=patch_data)

if response.status_code == 200:
    print("[OK] AI Config updated successfully")
    data = response.json()
    print(f"  Name: {data.get('name')}")
    print(f"  Description: {data.get('description')}")
else:
    print(f"[ERROR] {response.status_code}: {response.text}")
```

## Archive AI Config

Archiving temporarily disables an AI Config while preserving all its data:

```python
def archive_config(project_key, config_key, api_token, archive=True):
    """Archive or unarchive an AI Config"""
    url = f"https://app.launchdarkly.com/api/v2/projects/{project_key}/ai-configs/{config_key}"

    headers = {
        "Authorization": f"{api_token}",
        "Content-Type": "application/json"
    }

    patch_data = {"archived": archive}

    response = requests.patch(url, headers=headers, json=patch_data)

    if response.status_code == 200:
        status = "archived" if archive else "unarchived"
        print(f"[OK] AI Config {status} successfully")
        return response.json()
    else:
        print(f"[ERROR] {response.status_code}: {response.text}")
        return None

# Archive a config
archive_config(PROJECT_KEY, CONFIG_KEY, API_TOKEN, archive=True)

# Unarchive a config
archive_config(PROJECT_KEY, CONFIG_KEY, API_TOKEN, archive=False)
```

## Delete AI Config

Permanently delete an AI Config. This operation cannot be undone:

```python
def delete_config(project_key, config_key, api_token, confirm=False):
    """Permanently delete an AI Config

    Args:
        confirm: Must be True to actually delete (safety check)
    """
    url = f"https://app.launchdarkly.com/api/v2/projects/{project_key}/ai-configs/{config_key}"

    headers = {
        "Authorization": f"{api_token}"
    }

    if not confirm:
        print(f"[WARNING] Delete skipped - set confirm=True to delete '{config_key}'")
        return False

    response = requests.delete(url, headers=headers)

    if response.status_code == 204:
        print(f"[OK] AI Config '{config_key}' deleted successfully")
        return True
    else:
        print(f"[ERROR] deleting config: {response.status_code}")
        print(response.text)
        return False

# Delete a config (requires confirm=True)
delete_config(PROJECT_KEY, CONFIG_KEY, API_TOKEN, confirm=True)
```

## Batch Operations

Update multiple configs efficiently:

```python
def batch_update_configs(project_key, updates, api_token):
    """Update multiple AI Configs"""
    results = []

    for config_key, patch_data in updates.items():
        url = f"https://app.launchdarkly.com/api/v2/projects/{project_key}/ai-configs/{config_key}"

        headers = {
            "Authorization": f"{api_token}",
            "Content-Type": "application/json"
        }

        response = requests.patch(url, headers=headers, json=patch_data)

        results.append({
            "config_key": config_key,
            "success": response.status_code == 200,
            "status_code": response.status_code
        })

    return results

# Example batch update
updates = {
    "config-1": {"name": "Updated Config 1"},
    "config-2": {"archived": True},
    "config-3": {"description": "New description"}
}

results = batch_update_configs(PROJECT_KEY, updates, API_TOKEN)
for result in results:
    print(f"{result['config_key']}: {'Success' if result['success'] else 'Failed'}")
```

## Updatable Fields

The AI Config update endpoint accepts a simple object with fields to update:

| Field | Description | Value Type |
|-------|-------------|------------|
| `name` | Config display name | string |
| `description` | Config description | string |
| `archived` | Archive status | boolean |
| `tags` | Config tags | array of strings |

## Error Handling

Handle common update and delete errors:

```python
def safe_update_config(project_key, config_key, patch_data, api_token):
    """Update config with comprehensive error handling"""
    url = f"https://app.launchdarkly.com/api/v2/projects/{project_key}/ai-configs/{config_key}"

    headers = {
        "Authorization": f"{api_token}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.patch(url, headers=headers, json=patch_data)

        if response.status_code == 200:
            return {"success": True, "data": response.json()}
        elif response.status_code == 400:
            return {"success": False, "error": "Invalid request format"}
        elif response.status_code == 404:
            return {"success": False, "error": "AI Config not found"}
        elif response.status_code == 409:
            return {"success": False, "error": "Conflict - config may have been modified"}
        else:
            return {"success": False, "error": f"Unexpected error: {response.status_code}"}

    except requests.exceptions.RequestException as e:
        return {"success": False, "error": f"Request failed: {str(e)}"}

# Use with error handling
result = safe_update_config(
    PROJECT_KEY,
    CONFIG_KEY,
    {"name": "New Name"},
    API_TOKEN
)

if result["success"]:
    print("[OK] Update successful")
else:
    print(f"[ERROR] Update failed: {result['error']}")
```

## Best Practices

### 1. Backup Before Delete
Always export config data before deletion using the API to GET the config and save to a file.

### 2. Use Archiving First
Archive configs before deletion to ensure they're no longer needed:

1. Archive the config
2. Monitor for any issues
3. Delete after confirmation period

### 3. Validate Updates
Check the update object before applying - ensure it only contains valid fields (name, description, archived, tags).

## Complete Example

Update, archive, and manage an AI Config lifecycle:

```python
import requests
import json

class AIConfigManager:
    def __init__(self, project_key, api_token):
        self.project_key = project_key
        self.api_token = api_token
        self.base_url = f"https://app.launchdarkly.com/api/v2/projects/{project_key}"
        self.headers = {
            "Authorization": api_token,
            "Content-Type": "application/json"
        }

    def update(self, config_key, patch_data):
        """Update an AI Config"""
        url = f"{self.base_url}/ai-configs/{config_key}"
        response = requests.patch(url, headers=self.headers, json=patch_data)
        return response.status_code == 200, response

    def archive(self, config_key):
        """Archive an AI Config"""
        return self.update(config_key, {"archived": True})

    def unarchive(self, config_key):
        """Unarchive an AI Config"""
        return self.update(config_key, {"archived": False})

    def delete(self, config_key):
        """Delete an AI Config"""
        url = f"{self.base_url}/ai-configs/{config_key}"
        response = requests.delete(url, headers={"Authorization": self.api_token})
        return response.status_code == 204

# Usage
manager = AIConfigManager(PROJECT_KEY, API_TOKEN)
success, response = manager.update("test-config", {"description": "Updated via AIConfigManager"})
```

## Related Skills

### Management Workflow
- `aiconfig-create` - Create configs first
- `aiconfig-api` - API reference for updates
- `aiconfig-variations` - Update variations

### Related Operations
- `aiconfig-tools` - Update tool attachments
- `aiconfig-targeting` - Update targeting rules
- `aiconfig-experiments` - Update experiment settings
## References

- [LaunchDarkly API Documentation](https://apidocs.launchdarkly.com)
- [AI Configs Documentation](https://docs.launchdarkly.com/home/ai-configs)