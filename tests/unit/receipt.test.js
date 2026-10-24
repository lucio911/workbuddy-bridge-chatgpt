import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeReceipt, verifyReceipt } from '../../src/receipt.js';

test('makeReceipt writes a SHA-256 receipt file', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wbc-receipt-'));
  const cwd = process.cwd();
  process.chdir(tmp);
  try {
    const r = makeReceipt({
      packet: { packet_id: 'pid-x' },
      result: { verdict: 'proceed' },
      browserEvidence: { url: 'https://chatgpt.com/' },
      runState: { mode: 'temporary' },
    });
    assert.ok(r.receipt_id);
    assert.ok(fs.existsSync(r.file));
    const read = verifyReceipt(r.file);
    assert.equal(read.ok, true);
    assert.equal(read.receipt.packet_id, 'pid-x');
  } finally {
    process.chdir(cwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
