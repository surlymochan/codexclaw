# CodexClaw

面向飞书的 WebSocket 网关，用来连接并持久化本地 `codex` CLI 会话。

## 概览

- 每个飞书会话对应一个 Codex thread
- 默认纯文本，必要时使用 Markdown
- 本地状态保存 session、去重、记忆、story 和定时任务
- 从你在仓库根目录创建的本地文件加载 guidance
- 支持 heartbeat 和 cron 后台任务

## 环境要求

- Node.js 22+
- 已开启 WebSocket 事件推送的飞书应用
- 本地可用的 `codex` CLI

## 快速开始

```bash
cp .env.example .env
npm install
npm run init:local-guidance
npm run dev
```

完整启动流程见 [docs/quickstart.md](docs/quickstart.md)。

## 常驻运行

常驻运行可使用 macOS `launchd`：

```bash
npm run service:install
npm run service:restart
npm run service:uninstall
```

`npm run selfcheck` 会检查飞书凭据和本地 `codex`。

## 本地 Guidance

运行时会读取仓库根目录下的本地文件。这些文件已加入 gitignore。
通用模板在 [docs/templates](docs/templates)，本地引导说明在
[docs/local-guidance.md](docs/local-guidance.md)。

## 文档

- [docs/quickstart.md](docs/quickstart.md)
- [docs/local-guidance.md](docs/local-guidance.md)
- [docs/open-source.md](docs/open-source.md)
- [CHANGELOG.md](CHANGELOG.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)

## 命令

- `/reset` 重置当前 Codex session
- `/status` 查看 session 绑定状态
- `/diag` 查看运行诊断信息
- `/new` 新建 thread 并重新加载 guidance
- `/compact` 请求压缩并重新注入 guidance
