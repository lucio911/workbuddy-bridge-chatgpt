import test from 'node:test';
import assert from 'node:assert/strict';
import { findBrowser } from '../../src/doctor.js';
import { askChatGPT } from '../../src/web-client.js';

// E2E requires a real browser (Edge or Chrome) + a logged-in ChatGPT session,
// so it is skipped unless WBC_E2E=1 is exported AND a browser is resolvable.
const RUN_E2E = process.env.WBC_E2E === '1' && !!findBrowser().path;

test('web-client drives ChatGPT Web and returns an answer', { skip: !RUN_E2E }, async () => {
  const { answer, evidence } = await askChatGPT('Reply with the single word: pong', { mode: 'temporary' });
  assert.ok(typeof answer === 'string');
  assert.ok(answer.length > 0);
  assert.ok(evidence && evidence.url);
});
