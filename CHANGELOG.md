# Changelog

本项目所有重要变更记录于此文件。格式参考 [Keep a Changelog](https://keepachangelog.com/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.1] - 2026-10-24

### Fixed
- **修复登录窗口"一闪而过"的问题**。原 `askChatGPT` 仅在 `goto` 后取一次 `page.url()` 判断是否已登录，
  但 ChatGPT 对未登录用户的重定向是异步的，`domcontentloaded` 那一刻 URL 仍是 `chatgpt.com/?temporary-chat=true`，
  被误判为"已登录"后跳过登录等待，随后 `waitForSelector('textarea')` 在登录页上永远拿不到输入框并超时关闭浏览器。
- 新增 `ensureLoggedIn(page)`：改为**轮询 DOM** 判断登录态（`textarea` 出现＝已登录；出现邮箱/密码框或 “Log in / 登录” 按钮＝登录页），
  未登录时**保持窗口打开挂起等待（默认 10 分钟）**，绝不立即超时关闭。

### Added
- 新增专用 `login` 子命令（`wbc login`）：打开主站并挂起等待用户登录，登录成功后才关闭窗口，
  把"首次登录"与"日常提问"分离，避免在日常 `ask` 流程里卡在登录页闪退。
- SKILL.md 增加登录引导：当 `doctor` 显示 `chatgpt_login` 未 ok 时，先引导用户执行 `login` 并确认登录后再 `ask`。

### Changed
- `docs/usage.md` 与 `docs/install.md`：补充首次登录请使用 `login` 命令的说明（窗口不再一闪而过）。

## [1.0.0] - 2026-10-24

首个公开版本。

### Added
- **核心能力**：将 WorkBuddy 的高成本推理任务（复杂调试/根因、架构权衡、代码审查、技术调研）卸载给已登录 ChatGPT Web，
  **无需 OpenAI API Key**，复用用户已有订阅额度。
- **浏览器承载**：`playwright-core` + 系统浏览器驱动官方 `chatgpt.com`；本机优先使用 Microsoft Edge，
  无 Edge 时回退 Chrome（支持 `WBC_BROWSER=auto|edge|chrome`、`EDGE_PATH`/`CHROME_PATH`）。
- **安全基座**：
  - `secrets.js`：出站密钥正则 + 语义扫描，发现密钥即拒绝发送并递归脱敏。
  - `consent.js`：版本化风险同意（状态存于包根 `.workbuddy-bridge/config.json`）。
  - `adoption-gate.js`：本地采纳门——ChatGPT 返回内容视为不可信，补丁/命令须由 WorkBuddy 自行重建。
  - `receipt.js`：SHA-256 收据，绑定 Context Packet / 推理结果 / 浏览器证据 / 运行状态，落盘 `.workbuddy-bridge/receipts/`。
- **CLI（`wbc`）**：`doctor` / `consent` / `validate` / `ask`（支持 `--dry-run`、`--json`、`--mode temporary|saved`、`--files`、`--test`）。
- **WorkBuddy Skill 封装**：`skills/workbuddy-bridge-chatgpt/SKILL.md`（11 步编排 + 强制本地采纳门）。
- **文档**：`docs/` 下 architecture / install / privacy / design / usage。
- **贡献指南**：`CONTRIBUTING.md`（开发环境、安全工作边界、PR 流程、发布打 tag）。

### Security
- 无后端服务、无浏览器扩展、无需 API Key；默认使用临时对话（`?temporary-chat=true`）以降低账户痕迹。
- 明确"不发什么"与账户风控说明（详见 `docs/privacy.md`）。
