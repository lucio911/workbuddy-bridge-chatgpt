import test from 'node:test';
import assert from 'node:assert/strict';
import { scan, containsSecret, redact, redactDeep } from '../../src/secrets.js';

test('scan detects common secret shapes', () => {
  const text = [
    'openai=sk-abcdefghijklmnopqrstuvwxyz123456',
    'AKIA1234567890ABCDEF',
    'mongodb://user:pass@host:27017/db',
    'ghp_abcdefghijklmnopqrstuvwxyz0123456789',
  ].join('\n');
  const found = scan(text);
  const types = found.map((f) => f.type);
  assert.ok(types.includes('openai_key'));
  assert.ok(types.includes('aws_access_key_id'));
  assert.ok(types.includes('db_connection_string'));
  assert.ok(types.includes('github_token'));
});

test('containsSecret true for credential-bearing text', () => {
  assert.equal(containsSecret('api_key=sk-abcdefghijklmnopqrstuvwxyz123456'), true);
});

test('containsSecret false for benign text', () => {
  assert.equal(containsSecret('function add(a,b){return a+b}'), false);
});

test('redact removes secret patterns', () => {
  const out = redact('token=sk-abcdefghijklmnopqrstuvwxyz123456 end');
  assert.ok(!out.includes('sk-abcdefghijklmnopqrstuvwxyz123456'));
  assert.ok(out.includes('[REDACTED]'));
});

test('redactDeep recurses through objects', () => {
  const obj = { a: 'secret api_key=sk-abcdefghijklmnopqrstuvwxyz123456', b: ['ok', { c: 'AKIA1234567890ABCDEF' }] };
  const out = redactDeep(obj);
  assert.ok(!JSON.stringify(out).includes('sk-abcdefghijklmnopqrstuvwxyz123456'));
  assert.ok(!JSON.stringify(out).includes('AKIA1234567890ABCDEF'));
  assert.equal(out.b[0], 'ok');
});
