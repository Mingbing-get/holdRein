# @hold-rein/plugin-web

Hold Rein 的 Web 插件 SDK 和浏览器运行时工具包，定义插件前端接口，并负责运行时加载和执行浏览器侧扩展。

## 功能与作用

- 定义 `WebPlugin` 类型，包括工具渲染、侧边栏面板、页脚渲染和浏览器运行时贡献。
- 提供 Web 插件注册表，用于注册、注销、监听和查询前端插件。
- 加载运行时 Web 插件清单，并处理 UMD 或模块格式的插件入口。
- 提供浏览器工具执行器注册机制，让插件在前端执行受控工具逻辑。
- 提供 Vite 共享依赖插件，帮助插件构建时复用宿主应用的 React、Ant Design 等依赖。

## 常用命令

```bash
corepack pnpm --filter @hold-rein/plugin-web build
corepack pnpm --filter @hold-rein/plugin-web typecheck
```
