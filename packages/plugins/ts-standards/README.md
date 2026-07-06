# @hold-rein/plugins-ts-standards

Hold Rein 的 TypeScript/JavaScript 项目规范插件，用于检测项目类型、注入开发流程技能，并在代码变更后触发独立校验。

## 功能与作用

- 检测工作区是否为 TypeScript 或 JavaScript 项目。
- 在主代理上下文中注入规划、修复和 TypeScript 规范相关技能目录。
- 为代码任务补充系统提示，要求先理解需求、按任务类型使用对应流程，并遵守测试优先和代码规范。
- 在检测到代码文件变更后触发 `ts-standards-validator` 子代理，对变更文件进行只读校验。
- 校验提示会覆盖文件组织、测试覆盖、测试命令、代码风格命令和仓库规则。

## 常用命令

```bash
corepack pnpm --filter @hold-rein/plugins-ts-standards build
corepack pnpm --filter @hold-rein/plugins-ts-standards dev
corepack pnpm --filter @hold-rein/plugins-ts-standards typecheck
```
