// src/secrets.js
// Secret scanning + redaction for outbound Context Packets.
// Pattern list is intentionally broad but conservative: it targets high-signal
// credential shapes and assignment patterns, not free text.

const SECRET_PATTERNS = [
  { type: 'openai_key', re: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g },
  { type: 'anthropic_key', re: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { type: 'aws_access_key_id', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { type: 'aws_secret_access_key', re: /aws_secret_access_key\s*=\s*['"]?[A-Za-z0-9/+=]{40}/gi },
  { type: 'github_token', re: /\bgh[po]_[A-Za-z0-9]{36,}\b/g },
  { type: 'private_key_block', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g },
  { type: 'bearer_token', re: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/g },
  { type: 'password_assignment', re: /(password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]{6,}/gi },
  { type: 'secret_assignment', re: /(secret|api[_-]?key|access[_-]?key|client[_-]?secret)\s*[:=]\s*['"]?[A-Za-z0-9._~+/=-]{12,}/gi },
  { type: 'db_connection_string', re: /\b(?:mongodb(\+srv)?|postgres(?:ql)?|mysql|redis|amqp|ftp):\/\/[^\s]+/gi },
  { type: 'slack_token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { type: 'google_api_key', re: /AIza[0-9A-Za-z_-]{35}/g },
  { type: 'stripe_key', re: /(sk|pk|rk)_(live|test)_[0-9A-Za-z]{16,}/g },
];

function mask(value) {
  if (!value || value.length <= 6) return '*'.repeat(value ? value.length : 4);
  return value.slice(0, 3) + '*'.repeat(Math.min(value.length - 6, 12)) + value.slice(-3);
}

function classify(match) {
  for (const { type, re } of SECRET_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(match)) return type;
  }
  return 'secret';
}

/**
 * Scan a string for secret patterns.
 * @param {string} text
 * @returns {Array<{type:string, preview:string}>}
 */
export function scan(text = '') {
  const findings = [];
  if (typeof text !== 'string' || text.length === 0) return findings;
  for (const { type, re } of SECRET_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      findings.push({ type, preview: mask(m[0]) });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return findings;
}

/** @param {string} text */
export function containsSecret(text = '') {
  return scan(text).length > 0;
}

/**
 * Redact secrets in a string.
 * @param {string} text
 * @param {string} [replacement]
 */
export function redact(text = '', replacement = '[REDACTED]') {
  if (typeof text !== 'string' || text.length === 0) return text;
  let out = text;
  for (const { re } of SECRET_PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, (m) => `${replacement}:${classify(m)}`);
  }
  return out;
}

/**
 * Recursively redact string values inside an object (used for packet sanitization).
 * @param {unknown} value
 */
export function redactDeep(value) {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactDeep(v);
    return out;
  }
  return value;
}
