# @hold-rein/plugins-base

Hold Rein 的基础能力插件，提供命令执行、命令输出读取、命令终止和子代理相关的核心交互能力。

## 功能与作用

- 服务端贡献 shell 执行、读取和终止工具，让代理可以在工作区中运行命令。
- 管理按任务归属的 shell 进程，并在主代理结束后延迟清理相关进程。
- 提供插件路由，用于 Web 端查询和展示运行中的 shell 进程。
- Web 端提供 shell 工具调用渲染、子代理工具渲染和右侧 shell 进程面板。
- 作为代理执行代码任务时最基础的运行时能力插件之一。

## 常用命令

```bash
corepack pnpm --filter @hold-rein/plugins-base build
corepack pnpm --filter @hold-rein/plugins-base dev
corepack pnpm --filter @hold-rein/plugins-base typecheck
```
