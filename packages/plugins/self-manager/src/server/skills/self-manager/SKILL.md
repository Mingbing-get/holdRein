---
name: self-manager
description: Use when you need to manage or view agent, plugin, skills, model, scheduled-tasks, workspaces, or usage information.
---

# Self Manager

Use this skill when the user asks you to manage or view Hold Rein agents,
plugins, skills, models, scheduled tasks, workspaces, or usage statistics.

You must use `requestSelfApi` for all API calls. The tool path must be an
absolute API path that starts with `/api/v1/xxxx`. Do not include a host. Replace
`:params` in route templates with encoded concrete values before calling the
tool.

Before calling an API, read the relevant reference:

- Agent task metadata or workspace skills: `references/agent-api.md`
- Plugin listing, installation, enablement, or removal: `references/plugin-api.md`
- Skill listing, installation, enablement, or removal: `references/skill-api.md`
- Model providers, provider models, API keys, or model proxies: `references/model-api.md`
- Scheduled task listing, creation, updates, enablement, or deletion: `references/scheduled-task-api.md`
- Workspace history, settings, task pages, or deletion: `references/workspace-api.md`
- Token usage statistics: `references/usage-api.md`

Do not request APIs that are absent from these references.
