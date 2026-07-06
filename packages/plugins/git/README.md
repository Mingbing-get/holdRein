# @hold-rein/plugins-git

Hold Rein 的 Git 辅助插件，提供工作区 Git 状态查询和前端 Git 面板能力。

## 功能与作用

- 服务端提供 Git 相关 API 路由，用于读取仓库状态等信息。
- 使用 `simple-git` 与当前工作区仓库交互。
- Web 端提供右侧 Git 面板，帮助用户在会话中查看代码变更状态。
- 将 Git 能力作为插件独立封装，便于宿主按需启用、禁用或替换。

## 常用命令

```bash
corepack pnpm --filter @hold-rein/plugins-git build
corepack pnpm --filter @hold-rein/plugins-git dev
corepack pnpm --filter @hold-rein/plugins-git typecheck
```
