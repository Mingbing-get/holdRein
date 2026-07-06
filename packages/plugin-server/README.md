# @hold-rein/plugin-server

Hold Rein 的服务端插件 SDK 和运行时工具包，定义插件服务端接口，并负责插件发现、安装、加载、开发热更新和贡献合并。

## 功能与作用

- 定义 `ServerPlugin` 类型，包括工具、技能、系统提示、路由和代理结束回调等扩展点。
- 提供服务端插件注册表，用于注册插件、挂载插件路由和合并运行时贡献。
- 加载本地已安装插件，并解析插件包清单和 Web 插件清单。
- 支持插件安装、插件包初始化和共享依赖软链接。
- 提供开发模式插件管理器，让本地插件可以被主服务动态重载。

## 常用命令

```bash
corepack pnpm --filter @hold-rein/plugin-server build
corepack pnpm --filter @hold-rein/plugin-server typecheck
```
