# 设计决策（Design Notes）

## 与参考项目 `anightmonarch/codex-bridge-chatgpt` 的关系
本项目沿用其"推理与执行分离"的范式与三段式安全（出站清洗 + 本地采纳门 + SHA-256 收据），
并针对 **WorkBuddy** 的实际情况做了两处关键调整：

| 维度 | 参考项目 | 本项目 |
|------|----------|--------|
| 浏览器承载 | Codex 应用内浏览器 | `playwright-core` + 系统浏览器（WorkBuddy 无内置浏览器） |
| 交付形态 | 纯 Codex Skill | 独立 Node 包（`wbc` CLI）+ WorkBuddy Skill 封装 |

## 关键决策
1. **零核心依赖，仅 `playwright-core` 一处**：其余模块为纯 Node，便于审阅与移植。
2. **系统浏览器（Edge 优先、Chrome 兜底）而非完整 Playwright 下载**：避免数百 MB 浏览器下载；
   用 `playwright-core` 驱动本机浏览器，自动探测 Edge → Chrome，路径可由 `EDGE_PATH` / `CHROME_PATH` 指定，
   引擎选择由 `WBC_BROWSER`（`auto`/`edge`/`chrome`）控制。
3. **版本化风险同意**：`consent_version` 漂移时视为未授权，强制重新披露，符合"先知情再授权"。
4. **出站凭证剥离 + 尺寸上限**：`secrets.js` 正则/语义扫描 + `redactDeep` 递归脱敏；`estimateTokens ≤ 3000`。
5. **不可信入站 + 本地采纳门**：`proposed_changes[].sketch` 仅作思路，WorkBuddy 自行重建补丁；
   `tests[]` 仅作提示，命令由 WorkBuddy 决定并执行。
6. **选择器可配置**：`WBC_*_SELECTOR` 环境变量覆盖，UI 改版时无需改代码；失败时导出调试包。

## 已知局限
- **ChatGPT Web UI 脆弱性**：选择器变动会导致抽取失败（已有覆盖机制 + 调试包）。
- **账户风控**：非官方自动化存在被限流/处置风险，已默认临时对话并建议低频使用。
- **登录态保护**：profile 存本地，需用户自行保管，已加入 `.gitignore`。
- **测试覆盖**：非浏览器模块有完整单测/契约测试；Web 驱动仅在有浏览器（Edge/Chrome）+ `WBC_E2E=1` 时运行。
