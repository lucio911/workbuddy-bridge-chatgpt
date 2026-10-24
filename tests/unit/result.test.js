import test from 'node:test';
import assert from 'node:assert/strict';
import { parseResult, validateResult } from '../../src/result.js';

const JSON_ANSWER = JSON.stringify({
  packet_id: 'pid-1',
  verdict: 'proceed',
  assumptions: ['a1'],
  evidence_used: ['e1'],
  proposed_changes: [{ file: 'src/x.js', rationale: 'fix', sketch: 'change y to z' }],
  tests: ['npm test'],
  risks: ['r1'],
  unknowns: [],
});

test('parseResult extracts structured JSON', () => {
  const r = parseResult(JSON_ANSWER, 'pid-1');
  assert.equal(r.parsed, true);
  assert.equal(r.verdict, 'proceed');
  assert.equal(r.proposed_changes[0].file, 'src/x.js');
});

test('parseResult handles fenced JSON', () => {
  const r = parseResult('```json\n' + JSON_ANSWER + '\n```', 'pid-1');
  assert.equal(r.parsed, true);
  assert.equal(r.packet_id, 'pid-1');
});

test('parseResult falls back to heuristic on non-JSON', () => {
  const r = parseResult('I think you should check the timeout. More info needed about the env.', 'pid-2');
  assert.equal(r.parsed, false);
  assert.equal(r.verdict, 'needs_info');
});

test('validateResult flags packet_id mismatch', () => {
  const r = parseResult(JSON_ANSWER, 'pid-1');
  const v = validateResult(r, 'pid-different');
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes('packet_id')));
});
