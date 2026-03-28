# 快速开始

1. 克隆仓库。
2. 执行 `npm install`。
3. 将 `.env.example` 复制为 `.env`，并填写飞书和 Codex 配置。
4. 执行 `npm run init:local-guidance`。
5. 执行 `npm run dev` 进行本地开发，或执行 `npm run service:install` 使用常驻模式。

`npm run init:local-guidance` 只会创建缺失的本地文件。详细说明见
[docs/local-guidance.md](docs/local-guidance.md)。

如果你想把“安装依赖 + 生成本地 guidance + 安装常驻服务”合成一条命令，
可以使用：

```bash
npx -y codexclaw bootstrap --service
```
