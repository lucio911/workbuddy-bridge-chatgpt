# 隐私与账户风险（Privacy & Risk）

## 本工具**不会**发送什么
- 密码、token、API key、私钥、数据库连接串（出站前经 `secrets.js` 扫描并脱敏/拦截）
- 完整私有仓库；仅发送**决策性证据**的摘录（git 状态/diff 摘要、指定文件片段、测试输出）
- 无关上下文；Context Packet 压缩到约 1–3K token

## 本工具**会**发送什么
- 一个结构化的 Context Packet：任务目标、验收标准、最小化仓库证据、约束、明确问题
- 仅经由官方 `https://chatgpt.com/`，不接触私有端点，不读取 cookie 之外的浏览器存储

## 入站数据处理
- ChatGPT 的回答一律视为**不可信数据**
- 本地采纳门（Local Adoption Gate）内由 WorkBuddy 重验每条建议并**自行重建**补丁/命令
- 网页内容**绝不**直接透传到工具调用

## 账户风险（重要）
- 这是对 ChatGPT Web 的**非官方自动化**，可能触发平台风控、临时限制乃至账号处置。
- 缓解措施：
  - 默认使用**临时对话**（`--mode temporary`），不留下长期记忆
  - 低频调用、拟人节奏（如需可在 web-client 中调整等待/限速）
  - 仅用于本人账号，且先阅读并完成风险同意
- 登录态 profile 存于本地 `.workbuddy-bridge/browser-profile/`，**请勿分享或提交到版本库**。

## 审计
- 每次运行生成 SHA-256 收据，绑定 packet / result / 浏览器证据 / 运行状态，落盘
  `.workbuddy-bridge/receipts/`，可供回溯。
