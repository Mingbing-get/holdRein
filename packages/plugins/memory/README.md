# @hold-rein/plugins-memory

Hold Rein 的记忆插件，用于把工作区相关记忆注入代理上下文，并在主代理结束后整理新的记忆线索。

## 功能与作用

- 根据当前工作区创建记忆系统提示，让代理在对话中获得长期上下文。
- 在主代理完成后触发 `memory-organizer` 子代理，整理本轮对话中值得保留的信息。
- 避免记忆整理代理递归触发自身提示，保持记忆流程可控。
- 当前 Web 入口只注册插件身份，不额外贡献界面组件。

## 常用命令

```bash
corepack pnpm --filter @hold-rein/plugins-memory build
corepack pnpm --filter @hold-rein/plugins-memory dev
corepack pnpm --filter @hold-rein/plugins-memory typecheck
```
