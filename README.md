# workbuddy-bridge-chatgpt

> **ChatGPT 出方案，WorkBuddy 验证并执行。**

`workbuddy-bridge-chatgpt`（命令别名 `wbc`）是一个**自包含的 Node 包 + WorkBuddy Skill 封装**，把 WorkBuddy 的高成本推理任务（复杂调试/根因、架构权衡、代码审查、技术调研）卸载给**已登录的 ChatGPT Web 会话**。

- ✅ **无需 OpenAI API Key** —— 复用你已有的 ChatGPT 订阅额度
- ✅ **无后端服务、无浏览器扩展** —— 仅用 `playwright-core` + 系统浏览器（Edge 优先、Chrome 兜底）驱动官方 `chatgpt.com`
- ✅ **本地主权** —— WorkBuddy 始终掌握仓库事实、文件编辑与命令执行的最终控制权
- ✅ **安全可审计** —— 出站凭证剥离 + 本地采纳门（Local Adoption Gate）+ SHA-256 收据

设计参考：[anightmonarch/codex-bridge-chatgpt](https://github.com/anightmonarch/codex-bridge-chatgpt) 的"推理与执行分离"范式，并针对 WorkBuddy 调整为 `playwright-core` 承载 + 独立 Node 包形态。

---

## 快速开始

```bash
# 1. 安装依赖（仅 playwright-core，本机已安装 Edge 或 Chrome 即可，无需下载浏览器）
npm install

# 2. 预检环境
node src/cli.js doctor --json

# 3. 首次风险同意（会展示披露说明）
node src/cli.js consent enable

# 4. 登录一次 ChatGPT（会打开浏览器，请手动登录）
node src/cli.js ask --task "Diagnose this intermittent test failure" --json
```

> **浏览器**：自动探测 **Edge → Chrome**；可用 `WBC_BROWSER=auto|edge|chrome` 指定引擎，
> 或用 `EDGE_PATH` / `CHROME_PATH` 显式给出可执行文件路径（详见 `docs/install.md`）。

在 WorkBuddy 中安装 Skill 后，直接发起：

```
$workbuddy-bridge-chatgpt Diagnose this complex bug, propose the smallest safe fix, and list the tests to run.
```

---

## 工作原理（11 步）

```
Invoke → Doctor → Risk consent → Evidence(local) → Context Packet(build+sanitize)
  → Web reasoning(Playwright → chatgpt.com → answer) → Result(parse+validate)
  → Local Adoption Gate(verify+reconstruct) → Edit+test(WorkBuddy) → Receipt(audit)
```

详见 [docs/architecture.md](docs/architecture.md) 与 [docs/design.md](docs/design.md)。

## 安全与隐私

- **出站**：Context Packet 经 `secrets.js` 正则 + 语义扫描，剥离密码 / token / API key / 私钥 / 连接串，压缩到约 1–3K token。
- **入站**：ChatGPT 的回答一律视为**不可信数据**；本地采纳门内由 WorkBuddy 重验每条建议并自行重建补丁/命令，**绝不**把网页内容直接透传到工具调用。
- **审计**：每次运行生成 SHA-256 收据，绑定 packet / result / 浏览器证据 / 运行状态，落盘 `.workbuddy-bridge/receipts/`。

> ⚠️ **账户风险**：本项目是对 ChatGPT Web 的非官方自动化，可能触发平台风控、临时限制或账号处置。请仅用于你本人账号、低频率、且优先使用"临时对话"模式。详见 [docs/privacy.md](docs/privacy.md)。

## 许可证

MIT —— 见 [LICENSE](LICENSE)。
