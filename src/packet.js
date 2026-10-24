// src/packet.js
// Context Packet: build -> sanitize -> validate -> render to ChatGPT prompt.
import crypto from 'node:crypto';
import { redactDeep, containsSecret } from './secrets.js';

export const PACKET_SCHEMA_VERSION = '1.0';
export const MAX_APPROX_TOKENS = 3000;

/** Approximate token count (~4 chars/token heuristic, conservative for mixed text). */
export function estimateTokens(text = '') {
  const s = typeof text === 'string' ? text : JSON.stringify(text);
  return Math.ceil(s.length / 4);
}

/**
 * Build a structured Context Packet.
 * @param {object} input
 * @param {string} input.objective
 * @param {string[]} [input.acceptance_criteria]
 * @param {object} [input.repo_state]
 * @param {string[]} [input.constraints]
 * @param {string[]} [input.explicit_questions]
 */
export function buildPacket({ objective, acceptance_criteria = [], repo_state = {}, constraints = [], explicit_questions = [] } = {}) {
  const packet = {
    packet_id: crypto.randomUUID(),
    schema_version: PACKET_SCHEMA_VERSION,
    objective: objective || '',
    acceptance_criteria: Array.isArray(acceptance_criteria) ? acceptance_criteria : [acceptance_criteria].filter(Boolean),
    repo_state: repo_state || {},
    constraints: Array.isArray(constraints) ? constraints : [constraints].filter(Boolean),
    explicit_questions: Array.isArray(explicit_questions) ? explicit_questions : [explicit_questions].filter(Boolean),
  };
  const approxTokens = estimateTokens(JSON.stringify(packet));
  return { packet, approxTokens };
}

export function sanitizePacket(packet) {
  return redactDeep(packet);
}

/**
 * Validate an outbound packet.
 * @param {object} packet
 * @returns {{ok:boolean, errors:string[]}}
 */
export function validatePacket(packet) {
  const errors = [];
  if (!packet || typeof packet !== 'object') {
    return { ok: false, errors: ['packet is not an object'] };
  }
  if (!packet.packet_id) errors.push('missing packet_id');
  if (!packet.objective || !packet.objective.trim()) errors.push('missing objective');
  if (containsSecret(JSON.stringify(packet))) errors.push('packet contains a secret pattern');
  const tok = estimateTokens(JSON.stringify(packet));
  if (tok > MAX_APPROX_TOKENS) errors.push(`approx tokens ${tok} exceeds limit ${MAX_APPROX_TOKENS}`);
  return { ok: errors.length === 0, errors };
}

export const RESULT_CONTRACT = `请严格按以下 JSON 结构回复（仅输出一个 JSON 对象，不要包裹在 Markdown 代码块或多余解释中）：
{
  "packet_id": "<回显上面的 packet_id>",
  "verdict": "proceed | needs_info | abstain",
  "assumptions": ["..."],
  "evidence_used": ["..."],
  "proposed_changes": [{"file": "<相对路径或 N/A>", "rationale": "...", "sketch": "<思路/伪代码，不是最终补丁>"}],
  "tests": ["..."],
  "risks": ["..."],
  "unknowns": ["..."]
}`;

/**
 * Render the ChatGPT prompt from a (optionally pre-sanitized) packet.
 * @param {{packet:object, sanitized?:object}} param0
 */
export function toPrompt({ packet, sanitized }) {
  const body = sanitized || sanitizePacket(packet);
  return [
    '你是一名资深软件工程师的推理协作者。下面是一份结构化的仓库上下文包（Context Packet）。',
    '请基于其中"决定性证据"进行推理，给出可验证的建议。',
    '',
    '```json',
    JSON.stringify(body, null, 2),
    '```',
    '',
    '请遵守：',
    '1. 不要编造上下文中不存在的文件或接口；若信息不足，verdict 设为 needs_info 并提出明确问题。',
    '2. proposed_changes 只给思路/草图，不要给出需要直接复制执行的完整补丁或命令。',
    '3. 严格按以下结构回复（仅一个 JSON 对象）：',
    RESULT_CONTRACT,
  ].join('\n');
}
