# 更新日志

CodexClaw 的重要变更都记录在这里。

## v0.1.0

首次公开发布。

### 新增

- 面向飞书 WebSocket 的本地 Codex 会话网关。
- 每个飞书会话对应一个 Codex thread。
- 提供用于工作区运行态的本地 guidance 模板。
- 支持 `heartbeat` 和 `cron` 后台任务。
- 支持 macOS `launchd` 常驻脚本。
- 使用 MIT 协议。

### 说明

- 个人运行文件会在本地生成，并且会被 git 忽略。
- 仓库里提供的是 `docs/templates/` 中的通用模板。
