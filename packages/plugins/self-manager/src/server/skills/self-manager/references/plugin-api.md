# Plugin API

Use these APIs when listing, installing, enabling, disabling, or uninstalling
runtime plugins. Call them through `requestSelfApi`.

## GET /api/v1/plugins

Lists installed runtime plugins.

Returns:

- `{ plugins: RuntimePluginManifest[] }`
- Each plugin manifest includes id, package name, version, web entry metadata,
  and disabled state when applicable.

## POST /api/v1/plugins/install

Installs a plugin and reloads runtime plugins.

Body:

- `source`: Package name, GitHub source, or local path to install.
- `sourceType`: Where to install the plugin from. Use `"npm"` for npm packages,
  `"github"` for GitHub sources, or `"local"` for local plugin paths.

Returns:

- Installed plugin manifest.

## PATCH /api/v1/plugins/:pluginId

Enables or disables an installed plugin.

Path parameters:

- `pluginId`: Runtime plugin id to update.

Body:

- `disabled`: `true` disables the plugin; `false` enables it.

Returns:

- Updated plugin manifest, or `notFound` when the plugin is unknown.

## DELETE /api/v1/plugins/:pluginId

Uninstalls an installed plugin and reloads runtime plugins.

Path parameters:

- `pluginId`: Runtime plugin id to uninstall.

Returns:

- `{ id: string }` for the uninstalled plugin.
