# Contract Reference — Context Packet & Reasoning Result

This document defines the two data contracts enforced by `workbuddy-bridge-chatgpt`.
Both are JSON. The packet is **outbound** (WorkBuddy → ChatGPT Web); the result is **inbound**
(ChatGPT Web → WorkBuddy). All web content is treated as untrusted.

## 1. Context Packet (outbound)

Built by `src/packet.js → buildPacket()`. Sanitized by `redactDeep()` (strips secrets).
Validated by `validatePacket()` (rejects missing `packet_id`, missing `objective`,
secret patterns, and token budget overflow > 3000 approx tokens).

```json
{
  "packet_id": "uuid-v4",
  "schema_version": "1.0",
  "objective": "字符串：要达成什么",
  "acceptance_criteria": ["字符串…"],
  "repo_state": {
    "cwd": "/abs/path",
    "is_git_repo": true,
    "branch": "main",
    "git_status": "…",
    "recent_diff": "…",
    "recent_log": "…",
    "uncommitted_stat": "…",
    "relevant_files": [{ "path": "…", "excerpt": "…", "truncated": true }],
    "test_results": "…"
  },
  "constraints": ["不可为 / 技术栈 / 规范…"],
  "explicit_questions": ["需要 ChatGPT 决策的问题…"]
}
```

Validation rules:
- `packet_id` present (UUID).
- `objective` non-empty.
- `containsSecret(JSON.stringify(packet)) === false`.
- `estimateTokens(JSON.stringify(packet)) <= 3000`.

## 2. Reasoning Result (inbound)

Returned by ChatGPT and parsed by `src/result.js → parseResult()`. Validation
(`validateResult`) checks `packet_id` echo and `verdict` enum.

```json
{
  "packet_id": "<回显上面的 packet_id>",
  "verdict": "proceed | needs_info | abstain",
  "assumptions": ["…"],
  "evidence_used": ["…"],
  "proposed_changes": [
    {
      "file": "<相对路径或 N/A>",
      "rationale": "…",
      "sketch": "<思路/伪代码，不是最终补丁>"
    }
  ],
  "tests": ["…"],
  "risks": ["…"],
  "unknowns": ["…"]
}
```

Local Adoption Gate rules (`src/adoption-gate.js`):
- `verdict === 'abstain'` → blocking, no changes applied.
- `verdict === 'needs_info'` → blocking, ask user / gather more context.
- `proposed_changes[].sketch` is **advisory only**; WorkBuddy reconstructs the real patch.
- `tests[]` strings are **hints**, not executable commands.
- A SHA-256 receipt binds packet + result + browser evidence + run state.

## 3. Receipt

Written to `.workbuddy-bridge/receipts/<receipt_id>.json`:

```json
{
  "receipt_id": "uuid-v4",
  "created_at": "ISO-8601",
  "packet_id": "…",
  "packet_hash": "sha256",
  "result_hash": "sha256",
  "browser_evidence_hash": "sha256",
  "run_state_hash": "sha256"
}
```
