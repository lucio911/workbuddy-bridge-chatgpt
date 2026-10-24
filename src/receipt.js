// src/receipt.js
// SHA-256 audit receipt binding packet / result / browser evidence / run state.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function hashObj(o) {
  return crypto.createHash('sha256').update(typeof o === 'string' ? o : JSON.stringify(o)).digest('hex');
}

/**
 * Create and persist a run receipt.
 * @param {object} param0
 * @param {object} [param0.packet]
 * @param {object} [param0.result]
 * @param {object} [param0.browserEvidence]
 * @param {object} [param0.runState]
 */
export function makeReceipt({ packet, result, browserEvidence = {}, runState = {} } = {}) {
  const receipt = {
    receipt_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    packet_id: packet && packet.packet_id ? packet.packet_id : null,
    packet_hash: hashObj(packet || {}),
    result_hash: hashObj(result || {}),
    browser_evidence_hash: hashObj(browserEvidence || {}),
    run_state_hash: hashObj(runState || {}),
  };
  const dir = path.resolve(process.cwd(), '.workbuddy-bridge', 'receipts');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${receipt.receipt_id}.json`);
  fs.writeFileSync(file, JSON.stringify(receipt, null, 2));
  return { ...receipt, file };
}

/**
 * Read back a receipt file and confirm it is internally well-formed.
 * (Full cryptographic re-derivation requires the original objects and is out of scope.)
 * @param {string} receiptPath
 */
export function verifyReceipt(receiptPath) {
  const r = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  return {
    ok: !!(r.packet_hash && r.result_hash && r.receipt_id),
    receipt: r,
  };
}
