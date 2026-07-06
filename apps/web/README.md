# @hold-rein/web

Hold Rein 的浏览器端控制台包，提供聊天工作区、模型配置、插件管理、技能管理、定时任务和使用统计等交互界面。

## 功能与作用

- 基于 React、Vite 和 Ant Design 构建主应用界面。
- 连接后端 API，管理模型提供商、工作区、代理任务和运行记录。
- 加载 `@hold-rein/plugin-web` 运行时插件，并允许插件扩展工具渲染、侧边栏面板和界面区域。
- 提供应用级 UI 状态、主题状态和工作区状态上下文。
- 作为 CLI 打包运行时的一部分，随 `hold-rein start` 提供本地 Web 控制台。

## 常用命令

```bash
corepack pnpm --filter @hold-rein/web dev
corepack pnpm --filter @hold-rein/web build
corepack pnpm --filter @hold-rein/web typecheck
```
