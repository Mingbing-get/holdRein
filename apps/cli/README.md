# @hold-rein/cli

Hold Rein 的命令行入口包，发布 `hold-rein` 和 `hr` 两个命令，用来启动本地服务以及管理插件包。

## 安装后命令

这个包发布后会提供两个等价的命令：

```bash
hold-rein <command>
hr <command>
```

## 命令总览

```text
hold-rein start
hold-rein plugin init
hold-rein plugin install <source>
hold-rein version
hold-rein help
```

## `hold-rein start`

启动打包后的 Hold Rein 本地服务。该命令会加载 CLI 包内的 API 运行时和 Web 静态资源，启动后可以在浏览器中打开输出的 URL 使用控制台。

### 基本用法

```bash
hold-rein start
```

默认监听地址是 `127.0.0.1:3001`。启动成功后会输出：

```text
Hold Rein is running at http://127.0.0.1:3001
```

### 指定监听地址

```bash
hold-rein start --host 0.0.0.0
```

`--host <host>` 用来指定服务绑定的主机地址。默认值是 `127.0.0.1`。

### 指定端口

```bash
hold-rein start --port 4000
```

`--port <port>` 用来指定服务监听端口。默认值是 `3001`。端口必须是 `1` 到 `65535` 之间的整数。

### 加载本地开发插件

```bash
hold-rein start --plugin-dev ../my-plugin
```

`--plugin-dev <path>` 用来加载本地插件源码，适合插件开发调试。该参数可以重复传入多个路径：

```bash
hold-rein start --plugin-dev ../plugin-a --plugin-dev ../plugin-b
```

开发插件发生变化时，运行时会尝试重新加载插件，让插件开发不必每次重新安装。

### 组合使用

```bash
hold-rein start --host 0.0.0.0 --port 4000 --plugin-dev ../my-plugin
```

这个命令会在 `0.0.0.0:4000` 启动服务，并额外加载 `../my-plugin` 作为开发模式插件。

## `hold-rein plugin init`

初始化一个新的 Hold Rein 插件包。该命令会调用插件服务端 SDK 的初始化逻辑，在目标目录生成插件项目所需的基础文件。

### 在当前目录初始化

```bash
hold-rein plugin init
```

如果不传任何参数，命令会以当前工作目录作为初始化位置。

### 在指定路径初始化

```bash
hold-rein plugin init --path ./plugins/my-plugin
```

`--path <path>` 用来指定插件包要创建或初始化的路径。

### 使用名称创建子目录

```bash
hold-rein plugin init --name my-plugin
```

`--name <name>` 用来在当前工作目录下创建一个同名子目录，并在其中初始化插件包。

### 同时指定路径和名称

```bash
hold-rein plugin init --path ./plugins --name my-plugin
```

这种写法适合在指定父目录下创建一个命名插件包。成功后会输出初始化得到的插件包名：

```text
Initialized plugin package <package-name>
```

## `hold-rein plugin install <source>`

安装一个插件包到本地插件目录。`<source>` 是必填参数，可以是当前命令运行位置可解析的插件来源。

### 安装到默认插件目录

```bash
hold-rein plugin install ./plugins/my-plugin
```

默认安装目录是当前用户主目录下的 `.hold-rein/plugins`。

### 安装到指定目录

```bash
hold-rein plugin install ./plugins/my-plugin --target ./runtime/plugins
```

`--target <path>` 用来指定插件安装目录。成功后会输出插件安装位置：

```text
Installed plugin to <destination>
```

### 常见用途

- 将本地开发完成的插件安装进运行时插件目录。
- 将外部插件包复制到某个隔离的插件根目录。
- 配合 `hold-rein start` 启动服务后，由后端运行时加载已安装插件。

## `hold-rein version`

打印当前 CLI 版本号。

```bash
hold-rein version
```

下面两个写法等价：

```bash
hold-rein --version
hold-rein -v
```

输出示例：

```text
0.0.4
```

## `hold-rein help`

打印 CLI 帮助信息。

```bash
hold-rein help
```

下面两个写法等价：

```bash
hold-rein --help
hold-rein -h
```

不传任何命令时，也会打印帮助信息：

```bash
hold-rein
```

## 错误处理

命令执行失败时会返回非零退出码，并打印错误原因。例如：

```bash
hold-rein start --port abc
```

会输出类似：

```text
Failed to start service: Port must be an integer between 1 and 65535
```

未知命令会输出命令名和完整帮助信息：

```bash
hold-rein unknown
```
