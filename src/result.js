// src/result.js
// Parse ChatGPT's answer into a structured Reasoning Result and validate it.
import { redactDeep } from './secrets.js';

export const RESULT_FIELDS = [
  'packet_id', 'verdict', 'assumptions', 'evidence_used',
  'proposed_changes', 'tests', 'risks', 'unknowns',
];

const VALID_VERDICTS = ['proceed', 'needs_info', 'abstain'];

function extractJson(text) {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : text;
  try {
    return JSON.parse(candidate.trim());
  } catch {}
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {}
  }
  return null;
}

function coerceArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

/**
 * Parse a ChatGPT answer into a structured Reasoning Result.
 * @param {string} text raw answer text
 * @param {string} [expectedPacketId]
 */
export function parseResult(text, expectedPacketId) {
  const json = extractJson(text);
  if (!json) return heuristicParse(text, expectedPacketId);

  const result = {
    packet_id: json.packet_id || expectedPacketId || null,
    verdict: VALID_VERDICTS.includes(json.verdict) ? json.verdict : 'proceed',
    assumptions: coerceArray(json.assumptions),
    evidence_used: coerceArray(json.evidence_used),
    proposed_changes: coerceArray(json.proposed_changes).map((c) => ({
      file: c && c.file != null ? String(c.file) : 'N/A',
      rationale: c && c.rationale != null ? String(c.rationale) : '',
      sketch: c && c.sketch != null ? String(c.sketch) : '',
    })),
    tests: coerceArray(json.tests),
    risks: coerceArray(json.risks),
    unknowns: coerceArray(json.unknowns),
    parsed: true,
    raw: text,
  };
  result.sanitized = redactDeep(result);
  return result;
}

function heuristicParse(text, expectedPacketId) {
  const result = {
    packet_id: expectedPacketId || null,
    verdict: /need(s)?\s*info|insufficient|more (info|information|context)/i.test(text || '') ? 'needs_info' : 'proceed',
    assumptions: [],
    evidence_used: [],
    proposed_changes: [],
    tests: [],
    risks: [],
    unknowns: [],
    parsed: false,
    raw: text,
    note: 'ChatGPT 未返回结构化 JSON，已按启发式解析；请在本地采纳门内人工核对。',
  };
  const blocks = [...(text || '').matchAll(/```(?:[\w-]+)?\n([\s\S]*?)```/g)].map((m) => m[1]);
  if (blocks.length) {
    result.proposed_changes.push({
      file: 'N/A',
      rationale: '从回答中的代码块提取（启发式）',
      sketch: blocks.join('\n\n').slice(0, 2000),
    });
  }
  result.sanitized = redactDeep(result);
  return result;
}

/**
 * Validate a parsed result against the expected packet id.
 * @param {object} result
 * @param {string} [expectedPacketId]
 */
export function validateResult(result, expectedPacketId) {
  const errors = [];
  if (!result) {
    return { ok: false, errors: ['empty result'] };
  }
  if (expectedPacketId && result.packet_id && result.packet_id !== expectedPacketId) {
    errors.push(`packet_id mismatch: got ${result.packet_id}, expected ${expectedPacketId}`);
  }
  if (!VALID_VERDICTS.includes(result.verdict)) {
    errors.push(`invalid verdict: ${result.verdict}`);
  }
  return { ok: errors.length === 0, errors };
}
