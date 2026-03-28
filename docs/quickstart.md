# 快速开始

1. 克隆仓库。
2. 执行 `npm install`。
3. 将 `.env.example` 复制为 `.env`，并填写飞书和 Codex 配置。
4. 执行 `npm run init:local-guidance`。
5. 执行 `npm run dev`，或用 `npm run service:install` 开常驻模式。
6. 想一条命令完成本地准备和常驻安装时，执行：

```bash
npx -y @surlymochan/codexclaw bootstrap --service
```

`npm run init:local-guidance` 只会创建缺失的本地文件，详细说明见 [docs/local-guidance.md](docs/local-guidance.md)。

只想先准备本地环境，不安装常驻服务时，把 `--service` 去掉：

```bash
npx -y @surlymochan/codexclaw bootstrap
```
