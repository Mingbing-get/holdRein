# @hold-rein/plugins-code

Hold Rein 的代码文件操作插件，提供读取、写入、编辑、删除、查找和搜索文件的代理工具及对应前端渲染。

## 功能与作用

- 服务端贡献文件读取、写入、删除、编辑、文件查找和内容搜索工具。
- 通过工作区执行环境约束文件访问范围，保证工具操作与当前任务上下文一致。
- 对大文件或长输出进行截断处理，避免工具结果过度膨胀。
- Web 端提供文件工具调用的可读渲染。
- Web 端提供文件变更摘要页脚，帮助用户快速看清代理修改了哪些文件。

## 常用命令

```bash
corepack pnpm --filter @hold-rein/plugins-code build
corepack pnpm --filter @hold-rein/plugins-code dev
corepack pnpm --filter @hold-rein/plugins-code typecheck
```
