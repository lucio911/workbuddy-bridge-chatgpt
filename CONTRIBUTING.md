# 贡献指南（CONTRIBUTING）

感谢你关注 `workbuddy-bridge-chatgpt`！本文件说明如何在本仓库开发、测试、提交与发布。
本项目遵循 **"ChatGPT 出方案，WorkBuddy 验证并执行"** 的推理—执行分离范式，并坚持**本地主权 + 不可信远程输出 + 安全可审计**三条底线。

> 重要：本项目通过 `playwright-core` 驱动**已登录的第三方网站（chatgpt.com）**进行非官方自动化。
> 这存在账户风控与对界面变动敏感的风险，且所有外部回答都被视为**不可信输入**。任何改动都不得削弱本地采纳门（Local Adoption Gate）与凭证剥离（secrets scan）这两条安全边界。

---

## 1. 开发环境准备

- **Node.js** ≥ 18（推荐 20+）。
- **系统浏览器**：本机需安装 Microsoft Edge 或 Google Chrome（任选其一即可，`playwright-core` 只驱动本机浏览器，**不下载**浏览器）。
  - 默认 `WBC_BROWSER=auto` 会优先探测 Edge，其次 Chrome。
  - 浏览器不在默认路径时设置：`EDGE_PATH=...` 或 `CHROME_PATH=...`，或显式 `WBC_BROWSER=edge|chrome`。
- **ChatGPT 订阅**：用于 Web 推理额度（免费/Plus/Pro 均可），首次运行需手动登录一次。

```bash
git clone https://github.com/lucio911/workbuddy-bridge-chatgpt.git
cd workbuddy-bridge-chatgpt
npm install          # 仅安装 playwright-core（其余为纯 Node 依赖，无额外下载）
```

---

## 2. 本地开发工作流

### 2.1 自检与授权
```bash
node src/cli.js doctor          # 预检：Node / playwright-core / 浏览器 / 登录态 / 风险同意
node src/cli.js consent enable  # 版本化风险同意（必做，状态存于包根 .workbuddy-bridge/config.json）
```

### 2.2 运行（先 dry-run 看清会发送什么）
```bash
# 仅构造并校验 Context Packet，打印将发给 ChatGPT 的内容（已脱敏），不触网
node src/cli.js ask --task "你的任务" --files src/a.js,src/b.js --test "npm test" --dry-run --json

# 正式运行（会打开浏览器、驱动 ChatGPT Web、返回结构化 Reasoning Result）
node src/cli.js ask --task "你的任务" --files src/a.js --test "npm test" --json
```

### 2.3 关键原则：本地采纳门（Local Adoption Gate）
ChatGPT 返回的 `proposed_changes[].sketch` 仅是**思路**，**绝不可**原样粘贴进编辑器或终端。
你（或 WorkBuddy）必须：自行重新打开文件重建补丁、跑你决定的测试、核对验收标准后再采纳。
每次运行在 `.workbuddy-bridge/receipts/`（当前项目目录）生成 SHA-256 收据，作为可审计留痕。

---

## 3. 目录结构与模块职责

```
src/
  cli.js            # 命令行入口（doctor/consent/validate/ask，支持 --json、--dry-run）
  doctor.js         # 预检 + 浏览器解析（findEdge/findChrome/findBrowser/checkBrowser）
  consent.js        # 版本化风险同意（状态锚定包根 .workbuddy-bridge/config.json）
  secrets.js        # 出站密钥正则 + 语义扫描与递归脱敏
  evidence.js       # 本地只读证据采集（git status/diff/log、文件摘录、测试输出）
  packet.js         # Context Packet 构造 → 清洗 → 校验（≤3000 token）→ 转 prompt
  web-client.js     # playwright-core 驱动 chatgpt.com（粘贴→提交→等待→抽取；失败导出调试包）
  result.js         # 把回答解析为结构化 Reasoning Result 并校验 packet_id 回显
  adoption-gate.js  # 本地采纳门：Web 内容不可信，强制本地重建
  receipt.js        # SHA-256 收据（绑定 packet/result/浏览器证据/运行状态）
  paths.js          # 包根/状态目录解析（PKG_ROOT / STATE_ROOT / stateDir）
skills/workbuddy-bridge-chatgpt/   # WorkBuddy Skill 封装（SKILL.md + references/）
docs/               # architecture / install / privacy / design / usage
tests/              # unit / contract / e2e
```

> 安全边界变更（secrets / consent / adoption-gate / receipt）属于**受保护区域**，PR 中若削弱这些边界需在描述中明确理由与替代保障。

---

## 4. 测试

```bash
npm test           # node --test 自动发现 tests/ 下用例
```

- **unit / contract**：纯 Node 模块，无需浏览器，应全部通过。
- **e2e**（Web 驱动）：默认跳过。需在**本机有可用浏览器 + 已登录 ChatGPT** 环境运行：
  ```bash
  WBC_E2E=1 WBC_BROWSER=edge node --test tests/e2e/
  ```
- 提交前请确保 `npm test` 非 e2e 用例全绿；e2e 失败通常源于 ChatGPT UI 选择器变动（见第 6 节）。

---

## 5. 代码约定

- **语言/风格**：ESM（`"type": "module"`），纯 Node 标准库 + 仅 `playwright-core` 一处外部依赖；优先可读性，避免引入新运行时依赖。
- **安全优先**：任何"发送到 ChatGPT"的内容都必须经过 `secrets.js` 扫描与 `packet.js` 清洗；任何"来自 ChatGPT"的内容都必须经 `result.js` 解析且不得直接进工具。
- **状态位置**：
  - 包根相对（与调用 cwd 无关）：同意状态、浏览器登录态、调试包 → `src/paths.js` 统一管理。
  - 当前项目相对（作审计留痕）：收据 `receipts/`。
- **提交信息**：建议祈使句 + 范围，例如 `feat(web-client): add retry on selector timeout`、`fix(secrets): cover bearer token pattern`。

---

## 6. 选择器与界面变动兼容

ChatGPT Web 的 DOM 可能改版，导致 `web-client.js` 抽不到回答。选择器通过环境变量覆盖，**无需改代码**：

```bash
WBC_TEXTAREA_SELECTOR='textarea' \
WBC_SEND_BUTTON_SELECTOR='button[data-testid="send-button"]' \
WBC_ASSISTANT_SELECTOR='[data-message-author-role="assistant"]' \
node src/cli.js ask --task "..." --json
```

失败时 `web-client.js` 会在 `.workbuddy-bridge/debug/` 导出调试包（含页面快照/日志），便于定位新选择器。
若你确认了稳定可用的新选择器，欢迎提 PR 更新 `web-client.js` 中的 `SELECTORS` 默认值。

---

## 7. Pull Request 流程

1. Fork 并创建特性分支：`git checkout -b feat/your-change`。
2. 本地完成改动并通过 `npm test`（非 e2e 全绿）。
3. 若涉及行为变更，同步更新 `docs/` 与 `skills/workbuddy-bridge-chatgpt/references/contract.md`。
4. 提交 PR，描述中应说明：
   - 解决了什么问题 / 新增什么能力；
   - 是否触碰安全边界（secrets/consent/adoption-gate/receipt），如触碰请说明保障；
   - 手动验证方式（如 `ask --dry-run` 输出、`doctor` 状态）。
5. 维护者评审通过后合并至 `main`。

---

## 8. 发布与打 Tag

本仓库采用语义化版本（SemVer）。发布步骤（仅维护者）：

```bash
# 1) 更新 package.json 的 version
# 2) 提交版本变更
git commit -am "chore: release vX.Y.Z"
# 3) 打 annotated tag 并推送
git tag -a vX.Y.Z -m "workbuddy-bridge-chatgpt vX.Y.Z"
git push origin main --tags
# 4) 在 GitHub 创建 Release，正文引用本文件与 docs/usage.md 的关键变更
```

---

## 9. 行为准则与安全声明

- 本项目**不收集、不上传**你的代码或凭证；所有出站内容在本地经脱敏后才会发送。
- 请勿在 Issue/PR 中粘贴任何真实密钥、Cookie 或会话令牌。
- 使用本工具产生的任何修改，**最终责任与验证均在本地**；远程推理结果仅供参考。
- 遵守 OpenAI 服务条款与你所处地区的法律法规；请勿高频或批量自动化以免触发账户风控。

许可证：MIT（见 `LICENSE`）。
