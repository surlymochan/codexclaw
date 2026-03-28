# 开源说明

CodexClaw 使用 MIT 协议。仓库包含代码、文档和模板，但你的个人运行
文件应该保留在 git 之外。

## 保留在 Git 中的内容

- 应用代码
- 测试
- 文档
- `docs/templates/` 中的通用模板

## 保留在本地的内容

- 由模板生成的根目录引导文件
- `daily-memory/`
- `HEARTBEAT.md`
- `CRON.md`
- `.env`
- `.data/`

## 原因

仓库需要能够安全公开，不能泄露私有记忆或工作区状态。用户通过
`npm run init:local-guidance` 自行初始化本地 guidance。
