# 架构说明（Architecture）

`workbuddy-bridge-chatgpt` 让 WorkBuddy 把高成本推理任务卸载给**已登录的 ChatGPT Web 会话**，
全程**无 API Key、无后端服务、无浏览器扩展**。核心哲学：**ChatGPT 出方案，WorkBuddy 验证并执行**。

## 组件与职责

| 模块 | 文件 | 职责 |
|------|------|------|
| 预检 | `src/doctor.js` | Node 版本、playwright-core、系统 Chrome、登录态、同意态 |
| 风险同意 | `src/consent.js` | 版本化显式同意，状态存 `.workbuddy-bridge/config.json` |
| 密钥扫描 | `src/secrets.js` | 出站内容正则 + 语义扫描与脱敏 |
| 证据采集 | `src/evidence.js` | 本地只读收集 git 状态/diff/log、相关文件、测试结果 |
| 上下文包 | `src/packet.js` | 构造 → 清洗 → 尺寸控制 → 出站校验 → 转 prompt |
| Web 推理客户端 | `src/web-client.js` | Playwright 驱动已登录 chatgpt.com：粘贴→提交→等待→抽取 |
| 结果解析 | `src/result.js` | 把回答解析为结构化 Reasoning Result 并校验 |
| 本地采纳门 | `src/adoption-gate.js` | 生成采纳清单，强制不可信输入原则 |
| 收据 | `src/receipt.js` | SHA-256 绑定 packet/result/浏览器证据/运行状态 |
| CLI | `src/cli.js` | version/doctor/consent/ask/validate 子命令 |
| Skill | `skills/workbuddy-bridge-chatgpt/SKILL.md` | WorkBuddy 内编排入口 |

## 数据流（11 步）

```
Invoke → Doctor → Risk consent → Evidence(local) → Context Packet(build+sanitize)
 → Web reasoning(Playwright → chatgpt.com → answer) → Result(parse+validate)
 → Local Adoption Gate(verify+reconstruct) → Edit+test(WorkBuddy) → Receipt(audit)
```

## 两个核心契约

- **Context Packet（出站）**：`packet_id` / `objective` / `acceptance_criteria` / `repo_state` /
  `constraints` / `explicit_questions`。出站前经 `secrets.js` 脱敏，且 `estimateTokens ≤ 3000`。
- **Reasoning Result（入站）**：`packet_id`（回显）/ `verdict` / `assumptions` / `evidence_used` /
  `proposed_changes` / `tests` / `risks` / `unknowns`。`proposed_changes[].sketch` 仅为思路，不是最终补丁。

详见 `skills/workbuddy-bridge-chatgpt/references/contract.md`。
