import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPacket, sanitizePacket, validatePacket, estimateTokens } from '../../src/packet.js';

test('buildPacket returns a packet with packet_id and objective', () => {
  const { packet } = buildPacket({ objective: 'diagnose flaky test', acceptance_criteria: ['tests pass'] });
  assert.ok(packet.packet_id);
  assert.equal(packet.objective, 'diagnose flaky test');
  assert.deepEqual(packet.acceptance_criteria, ['tests pass']);
});

test('validatePacket accepts a clean packet', () => {
  const { packet } = buildPacket({ objective: 'x', repo_state: { branch: 'main' } });
  const v = validatePacket(sanitizePacket(packet));
  assert.equal(v.ok, true);
});

test('validatePacket rejects a packet containing a secret', () => {
  const { packet } = buildPacket({ objective: 'x', repo_state: { note: 'api_key=sk-abcdefghijklmnopqrstuvwxyz123456' } });
  const v = validatePacket(packet);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes('secret')));
});

test('estimateTokens is roughly length/4', () => {
  assert.equal(estimateTokens('a'.repeat(400)), 100);
});
