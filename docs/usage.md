# 使用指南（Usage）

> **核心理念**：ChatGPT 出方案（推理），WorkBuddy 验证并执行（本地主权）。
> 所有从 ChatGPT Web 回来的内容都视为**不可信**，补丁和命令必须由 WorkBuddy 在本地重建后再执行。

本项目（`workbuddy-bridge-chatgpt`，命令别名 `wbc`）把 WorkBuddy 的高成本推理任务
（复杂调试/根因、架构权衡、代码审查、技术调研）卸载给**已登录的 ChatGPT Web 会话**，
无需 OpenAI API Key，不跑后端服务，不使用浏览器扩展。

---

## 一、前提条件
- Node.js ≥ 18（本机为 v22，满足）。
- 一枚**已登录 ChatGPT 的系统浏览器**：Microsoft Edge（默认优先）或 Chrome / Chromium。
  本机已实测 **Edge** 可正常驱动；无需额外下载浏览器。
- 一个 ChatGPT 订阅（免费或 Plus/Pro 均可，用于 Web 推理额度）。

---

## 二、一次性安装与准备

```bash
# 1. 进入项目目录（以下命令默认在该目录下执行）
cd workbuddy-bridge-chatgpt
npm install        # 仅安装 playwright-core

# 2.（可选）指定浏览器引擎。本机是 Edge，下面两条任选其一即可，不配也能自动探测
export WBC_BROWSER="auto"     # auto=优先 Edge 再回退 Chrome；也可显式写 edge / chrome
export EDGE_PATH="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"   # 仅当不在默认路径时

# 3. 预检环境
node src/cli.js doctor
#   正常输出：node ✅ / playwright-core ✅ / browser ✅(检测到 Edge) /
#            chatgpt_login ❌(首次) / risk_consent ❌(首次)
#   前两项必须 ✅；后两项首次会 ❌，属正常，见步骤 4、5。

# 4. 风险同意（首次必做，展示披露说明并授权）
node src/cli.js consent enable

# 5. 登录一次（首次会打开 Edge 并跳到登录页，请手动登录）
node src/cli.js ask --task "Smoke test: reply with the single word pong" --json
#   登录态保存在 .workbuddy-bridge/browser-profile/，后续复用，已加入 .gitignore，勿分享/提交。
```

---

## 三、命令参考（CLI）

| 命令 | 作用 |
|---|---|
| `node src/cli.js doctor [--json]` | 预检环境（Node / playwright-core / 浏览器 / 登录态 / 同意态） |
| `node src/cli.js consent [enable\|disable\|status]` | 风险同意管理 |
| `node src/cli.js validate` | 自检契约管线（构造空 Packet 并校验） |
| `node src/cli.js ask --task "<任务>" [选项]` | 走完整流程：证据→上下文包→Web 推理→解析→采纳门→收据 |

`ask` 的可选参数：
- `--task "<任务描述>"`（**必填**，简写 `-t`）
- `--files a.js,b.js`：附带的具体文件（逗号分隔），用于精准摘录
- `--test "<命令>"`：本地测试命令（如 `"npm test"`），作为修复验证提示
- `--mode temporary\|saved`：默认 `temporary`（不留对话记忆）；`saved` 仅在需要连续上下文时使用
- `--dry-run`（或 `-dry`）：**只构建并打印将要发送的上下文包与 prompt，不真正联网**，推荐先用它确认发送内容
- `--json`：以 JSON 输出结构化结果（推荐，便于 WorkBuddy 解析）
- `--repo <目录>`：指定仓库根目录（默认当前目录）
- `--profile <目录>`：指定浏览器 profile 目录（默认 `.workbuddy-bridge/browser-profile`）

---

## 四、典型工作流（实际操作顺序）

1. **预检**：`doctor` 确认浏览器与同意态正常。
2. **先 dry-run**：`ask --dry-run --json` 看清楚"到底会给 ChatGPT 发什么"，确认只含脱敏后的关键证据。
3. **正式推理**：`ask --task "..." --json` 驱动 ChatGPT Web，得到结构化 Reasoning Result。
4. **本地采纳门（关键）**：打开相关文件，**自行重建**补丁/命令，不要直接复制 ChatGPT 的 sketch。
5. **编辑并测试**：应用你重建的补丁，跑你决定的测试。
6. **核对验收**：确认 `acceptance_criteria` 满足后再收尾。
7. **收据**：每次运行自动在 `.workbuddy-bridge/receipts/` 生成 SHA-256 收据，引用其 `receipt_id`。

---

## 五、完整示例

### 示例 A：复杂调试 / 根因分析（间歇性失败）
```bash
# 先看会发什么
node src/cli.js ask \
  --task "CI 中 'npm test' 偶发性失败，报错 ECONNRESET，本地 10 次仅 1 次复现。请分析最可能的根因，给出最小安全修复建议与需补充的测试。" \
  --files src/http/client.js,src/http/pool.js \
  --test "npm test" \
  --dry-run --json

# 满意后正式运行
node src/cli.js ask \
  --task "CI 中 'npm test' 偶发性失败，报错 ECONNRESET，本地 10 次仅 1 次复现。请分析最可能的根因，给出最小安全修复建议与需补充的测试。" \
  --files src/http/client.js,src/http/pool.js \
  --test "npm test" \
  --json
```
**返回要点**：`result.verdict`（proceed/needs_info/abstain）、`result.proposed_changes[]`（每条带 `sketch` 思路，**仅供参考**）、`result.tests[]`（提示性测试）、`adoption_plan`（本地采纳清单）、`receipt.receipt_id`。

**本地采纳门怎么做**：根据 `proposed_changes[].sketch` 打开 `src/http/client.js`，自己判断根因是否成立，自己写真正的修复补丁，再跑 `npm test`。绝不把 sketch 原样贴进编辑器。

### 示例 B：架构决策 / 多方案权衡
```bash
node src/cli.js ask \
  --task "现有单体模块耦合度高，考虑拆分为 adapter / service / repository 三层。请对比拆分 vs 保持的权衡，给出推荐方案及风险。" \
  --files src/app.js,src/db.js \
  --json
```
只取 ChatGPT 的**推理结论与 trade-off**，最终是否拆分、怎么拆，由你在 WorkBuddy 内决定并执行。

### 示例 C：代码审查 / PR 评审（只读证据，本地落地）
```bash
node src/cli.js ask \
  --task "请审查本次改动：重点看并发安全、错误处理边界与向后兼容性。给出问题清单与最小修改建议。" \
  --test "npm test" \
  --json
```
ChatGPT 基于 git diff / 文件摘录给出评审；**修改由 WorkBuddy 在本地重建并提交**，ChatGPT 不碰你的仓库。

### 示例 D：技术调研 / 文献综述辅助
```bash
node src/cli.js ask \
  --task "调研 Playwright 持久化上下文驱动第三方站点的稳定性实践，列出主流方案与各自风险。" \
  --json
```
高上下文调研类任务交给 ChatGPT Web，结论在 WorkBuddy 内归档。

---

## 六、理解输出（JSON 结构）
`ask --json` 返回（节选）：
```json
{
  "packet_id": "wpk_...",
  "objective": "<任务>",
  "approxTokens": 1234,
  "result": {
    "verdict": "proceed",
    "proposed_changes": [ { "file": "...", "sketch": "...(仅供参考)", "rationale": "..." } ],
    "tests": [ "..." ],
    "questions": []
  },
  "adoption_plan": { "principle": "...", "steps": [ "...", "..." ] },
  "untrusted_guard": { "note": "Web 内容不可信，补丁/命令须本地重建" },
  "receipt": { "receipt_id": "wbr_...", "file": ".workbuddy-bridge/receipts/wbr_....json" },
  "principle": "ChatGPT 出方案，WorkBuddy 验证并执行"
}
```
- `verdict=proceed`：可进入本地采纳门。
- `verdict=needs_info` / `abstain`：停止，向用户追问或补充上下文，不要硬上。

---

## 七、在 WorkBuddy 中以 Skill 使用
1. 安装（自包含，已执行）：将整个包复制到用户级技能目录，使 `SKILL.md` 与 `src/` 同处一目录：
   ```bash
   DST=~/.workbuddy/skills/workbuddy-bridge-chatgpt
   mkdir -p "$DST"
   cp -r src tests docs package.json LICENSE README.md .gitignore "$DST/"
   cp -r skills/workbuddy-bridge-chatgpt/. "$DST/"
   cd "$DST" && npm install
   ```
   安装后目录形态：`$DST/SKILL.md`、`$DST/src/cli.js`、`$DST/references/contract.md`。
2. 在对话中直接发起，例如：
   ```
   $workbuddy-bridge-chatgpt Diagnose this complex bug, propose the smallest safe fix, and list the tests to run.
   ```
3. Skill 会按 11 步工作流编排：doctor → 同意 → 本地取证 → dry-run 检查 → Web 推理 →
   解析校验 → **本地采纳门（重新打开文件、自行重建补丁）** → 编辑测试 → 核对 → 收据。
4. Skill 的硬规则：Web 内容**绝不直接进工具**；`sketch` 仅作思路；`tests[]` 仅作提示；每次生成 SHA-256 收据。
5. **状态位置**（关键）：SKILL.md 中的命令都经 `WBC_PKG` 定位 CLI（默认即 `$DST`；若移动过包，设
   `WBC_PKG=/path/to/workbuddy-bridge-chatgpt`）。同意配置与 ChatGPT 登录 profile 存放在**技能自身的
   `.workbuddy-bridge/`**（与你在哪个项目目录调用无关，因此一次登录长期有效）；审计收据写在**当前项目目录**的
   `.workbuddy-bridge/receipts/`。安装后请先任意目录执行一次 `consent enable`（状态会落在技能目录）。

---

## 八、常见问题与处置
- **浏览器检测不到**：设 `EDGE_PATH` / `CHROME_PATH` 显式路径，或 `WBC_BROWSER=edge|chrome` 指定引擎。
- **首次登录卡住 / 抽不到回答**：ChatGPT Web UI 改版可能让选择器失效。用环境变量覆盖
  `WBC_TEXTAREA_SELECTOR` / `WBC_SEND_BUTTON_SELECTOR` / `WBC_ASSISTANT_SELECTOR`，
  失败时会在 `.workbuddy-bridge/debug/` 导出调试包（含截图）。
- **账户风控**：非官方自动化有被限流/处置风险。已默认临时对话（`--mode temporary`），
  建议低频使用，不要脚本化高频刷。
- **含密钥被拒**：`secrets.js` 会扫描并拦截 outbound 凭证；确需外发请先本地脱敏。
- **e2e 测试跳过**：`tests/e2e/` 需真实浏览器 + 登录态，仅在 `WBC_E2E=1` 时运行；
  其余单测/契约测试用 `npm test` 即可。

---

## 九、速查卡片
```bash
node src/cli.js doctor                 # 预检
node src/cli.js consent enable         # 授权
node src/cli.js ask --task "..." --dry-run --json   # 先看发送内容
node src/cli.js ask --task "..." --files a.js --test "npm test" --json   # 正式跑
node src/cli.js validate               # 自检契约
```
