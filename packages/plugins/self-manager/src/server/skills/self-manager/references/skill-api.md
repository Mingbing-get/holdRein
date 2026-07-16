# Skill API

Use these APIs when listing, installing, enabling, disabling, or uninstalling
global skills. Call them through `requestSelfApi`.

## GET /api/v1/skills

Lists installed global skills.

Returns:

- `{ skills: InstalledSkill[] }`
- Each skill includes id, name, path, and disabled status.

## POST /api/v1/skills/install

Installs a skill from a Git repository.

Body:

- `repositoryUrl`: Git repository URL or GitHub `SKILL.md` URL to install from.

Returns:

- Installed skill metadata.

## PATCH /api/v1/skills/:skillId

Enables or disables an installed skill.

Path parameters:

- `skillId`: Installed skill id to update.

Body:

- `disabled`: `true` disables the skill; `false` enables it.

Returns:

- Updated skill metadata, or `notFound` when the skill id is unknown.

## DELETE /api/v1/skills/:skillId

Uninstalls an installed skill.

Path parameters:

- `skillId`: Installed skill id to uninstall.

Returns:

- `{ id: string }` for the uninstalled skill.
