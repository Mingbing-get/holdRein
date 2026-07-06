# @hold-rein/api

Hold Rein 的后端服务包，负责启动 HTTP API、加载运行时插件，并为 Web 控制台和 CLI 打包运行时提供服务能力。

## 功能与作用

- 提供 Express 应用和 `startHoldReinServer` 启动入口。
- 暴露 `/api/v1` 业务 API、插件路由 `/plugin` 和插件静态资源 `/plugin-assets/:pluginDir`。
- 初始化数据库、模型服务、代理任务和定时任务等后端运行时模块。
- 通过 `@hold-rein/plugin-server` 加载已安装插件和开发模式插件。
- 可选挂载 Web 构建产物，让 CLI 能启动前后端一体的本地服务。

## 常用命令

```bash
corepack pnpm --filter @hold-rein/api dev
corepack pnpm --filter @hold-rein/api build
corepack pnpm --filter @hold-rein/api typecheck
```
