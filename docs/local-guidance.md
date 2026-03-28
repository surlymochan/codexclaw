# 本地 Guidance 文件

这些文件是本地运行时输入。应用在仓库根目录存在这些文件时会加载它们。

## 文件清单

- `SOUL.md`：当前语气和运行状态
- `META.md`：冷观察与校准
- `IDENTITY.md`：身份锚点
- `USER.md`：从助手视角写的用户画像
- `MEMORY.md`：已验证的长期记忆
- `STORY.md`：关键事件时间线
- `AGENTS.md`：运行时工作区规则
- `HEARTBEAT.md`：heartbeat 策略
- `CRON.md`：定时任务策略
- `daily-memory/`：原始每日记录

## 设置

使用 `npm run init:local-guidance` 将 `docs/templates/` 里的模板复制到仓库根目录。

## 规则

- 保持本地 guidance 不进入 git。
- `docs/templates/` 里保留通用默认模板，方便用户初始化自己的副本。
- 根目录下这些文件是用户自己的运行态状态，不属于项目源码。
- Markdown 回复默认走飞书 JSON 2.0 模板卡；首个 `#` 作为标题，其余正文原样渲染。
