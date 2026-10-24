# 安装与使用（Install）

## 1. 环境要求
- Node.js ≥ 18（推荐 20+）
- 一枚已登录 ChatGPT 的 **系统浏览器**：支持 **Microsoft Edge** 或 **Chrome / Chromium**
  （无需额外下载浏览器，`playwright-core` 只驱动本机已安装的 Edge / Chrome）
- 一个 ChatGPT 订阅（免费或 Plus/Pro 均可，用于 Web 推理额度）

## 2. 安装
```bash
git clone <your-fork>/workbuddy-bridge-chatgpt
cd workbuddy-bridge-chatgpt
npm install
```

浏览器路径解析（自动探测 Edge → Chrome；可用环境变量覆盖）：
```bash
# 自动探测：优先 Edge（若已安装），否则回退 Chrome
export WBC_BROWSER="auto"        # 可选：auto（默认）| edge | chrome

# 显式指定路径（优先级最高）
export EDGE_PATH="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
export CHROME_PATH="/path/to/google-chrome"
```

## 3. 预检
```bash
node src/cli.js doctor --json
```
检查项：`node` / `playwright-core` / `browser`（显示实际探测到的 Edge 或 Chrome）/ `chatgpt_login` / `risk_consent`。
`browser` 与 `chatgpt_login` 在首次使用前会报错，属正常。

## 4. 风险同意（首次）
```bash
node src/cli.js consent enable    # 展示披露说明并授权
node src/cli.js consent disable   # 随时撤销
```

## 5. 登录一次（专用 login 命令）
```bash
node src/cli.js login
```
打开浏览器并保持打开，直到你在窗口中手动登录成功（窗口不会一闪而过）。
登录态保存在 `.workbuddy-bridge/browser-profile/`，后续 `ask` 直接复用，请勿分享或提交。
> 说明：日常提问请用 `ask`；首次或 session 过期才用 `login`。即便直接用 `ask` 未登录，
> 现在也会挂起等待登录（不再闪退），但 `login` 职责更清晰、打开的是主站（非临时对话），更稳。

## 6. 在 WorkBuddy 中使用
将 `skills/workbuddy-bridge-chatgpt/` 安装为 WorkBuddy Skill（放入
`~/.workbuddy/skills/` 或项目 `.workbuddy/skills/`），然后：
```
$workbuddy-bridge-chatgpt Diagnose this complex bug, propose the smallest safe fix, and list the tests to run.
```

## 7. 常用命令
```bash
node src/cli.js ask --task "<任务>" --files src/x.js,src/y.js --test "npm test" --mode temporary --json
node src/cli.js ask --task "<任务>" --dry-run        # 仅构建并打印将发送的上下文包
node src/cli.js validate                              # 自检契约管线
```

## 8. UI 变动时的选择器覆盖
若 ChatGPT Web 改版导致抽取失败，可用环境变量覆盖（无需改代码）：
```bash
export WBC_TEXTAREA_SELECTOR="textarea"
export WBC_SEND_BUTTON_SELECTOR="button[data-testid='send-button']"
export WBC_ASSISTANT_SELECTOR="[data-message-author-role='assistant']"
```
失败时会导出调试包到 `.workbuddy-bridge/debug/`。
