import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPacket, sanitizePacket, validatePacket } from '../../src/packet.js';

test('contract: clean packet passes validation', () => {
  const { packet } = buildPacket({
    objective: 'choose between strategy A and B for caching',
    acceptance_criteria: ['latency improved', 'no regressions'],
    repo_state: { branch: 'main', git_status: 'clean' },
    constraints: ['must remain dependency-free for core'],
    explicit_questions: ['which strategy is safer for cold start?'],
  });
  const v = validatePacket(sanitizePacket(packet));
  assert.equal(v.ok, true, v.errors.join('; '));
});

test('contract: secret in repo_state is rejected', () => {
  const { packet } = buildPacket({
    objective: 'x',
    repo_state: { note: 'aws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' },
  });
  const v = validatePacket(packet);
  assert.equal(v.ok, false);
});
