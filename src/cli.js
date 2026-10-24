#!/usr/bin/env node
// src/cli.js — workbuddy-bridge-chatgpt (wbc) command-line entry.
import { runDoctor, formatDoctor } from './doctor.js';
import { getConsent, setConsent, DISCLOSURE, CONSENT_VERSION } from './consent.js';
import { collectEvidence } from './evidence.js';
import { buildPacket, sanitizePacket, validatePacket, toPrompt } from './packet.js';
import { askChatGPT, loginFlow } from './web-client.js';
import { parseResult, validateResult } from './result.js';
import { buildAdoptionPlan, assertUntrusted, PRINCIPLE } from './adoption-gate.js';
import { makeReceipt } from './receipt.js';

const VERSION = '0.1.0';

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const eq = key.indexOf('=');
      if (eq !== -1) {
        args.flags[key.slice(0, eq)] = key.slice(eq + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        args.flags[key] = argv[++i];
      } else {
        args.flags[key] = true;
      }
    } else if (a.startsWith('-') && a.length > 1) {
      args.flags[a.slice(1)] = true;
    } else {
      args._.push(a);
    }
  }
  return args;
}

function out(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

async function cmdDoctor() {
  const r = runDoctor();
  if (process.argv.includes('--json')) return out(r);
  console.log(formatDoctor(r));
  process.exit(r.ok ? 0 : 1);
}

function cmdConsent(sub) {
  if (sub === 'enable') {
    console.log(DISCLOSURE);
    console.log('\n>>> 已确认授权（consent_version=' + CONSENT_VERSION + '）');
    return out(setConsent(true));
  }
  if (sub === 'disable') return out(setConsent(false));
  return out(getConsent());
}

function cmdValidate() {
  // Lightweight self-check of the contract pipeline.
  const { packet } = buildPacket({
    objective: 'self-test',
    acceptance_criteria: ['ok'],
    repo_state: { branch: 'main' },
    constraints: [],
    explicit_questions: [],
  });
  const sanitized = sanitizePacket(packet);
  const v = validatePacket(sanitized);
  out({ ok: v.ok, packet_id: packet.packet_id, approxTokens: undefined, errors: v.errors });
  process.exit(v.ok ? 0 : 1);
}

async function cmdAsk(flags) {
  const task = flags.task || flags.t;
  if (!task) {
    console.error('缺少 --task "<任务描述>"。');
    process.exit(2);
  }
  const json = !!flags.json;
  const dryRun = !!flags['dry-run'] || !!flags.dry;
  const mode = flags.mode === 'saved' ? 'saved' : 'temporary';
  const cwd = flags.repo || process.cwd();
  const files = flags.files ? String(flags.files).split(',').map((s) => s.trim()).filter(Boolean) : [];
  const testCommand = flags.test || flags['test-command'] || null;

  // 1. preflight
  const doctor = runDoctor({ profileDir: flags.profile });
  if (!json) console.error(formatDoctor(doctor));

  // 2. consent gate
  const consent = getConsent();
  if (!consent.enabled) {
    if (json) return out({ error: 'risk_consent_not_enabled', disclosure: DISCLOSURE });
    console.error('\n' + DISCLOSURE);
    console.error('\n>>> 请先运行 `node src/cli.js consent enable` 授权自动化。');
    process.exit(3);
  }

  // 3. evidence
  const repoState = collectEvidence({ cwd, files, testCommand });
  if (dryRun) {
    const { packet, approxTokens } = buildPacket({ objective: task, repo_state: repoState });
    const sanitized = sanitizePacket(packet);
    const v = validatePacket(sanitized);
    const prompt = toPrompt({ packet, sanitized });
    if (json) {
      return out({ packet_id: packet.packet_id, approxTokens, valid: v.ok, errors: v.errors, prompt });
    }
    console.error(`[dry-run] packet_id=${packet.packet_id} approxTokens=${approxTokens} valid=${v.ok}`);
    if (!v.ok) console.error('[dry-run] validation errors:', v.errors);
    console.log(prompt);
    process.exit(0);
  }

  // 4. build + sanitize + validate packet
  const { packet, approxTokens } = buildPacket({ objective: task, repo_state: repoState });
  const sanitized = sanitizePacket(packet);
  const v = validatePacket(sanitized);
  if (!v.ok) {
    const msg = { error: 'packet_validation_failed', errors: v.errors };
    if (json) return out(msg);
    console.error('Context Packet 校验失败：', v.errors);
    process.exit(4);
  }

  const prompt = toPrompt({ packet, sanitized });

  // 5. web reasoning (requires Chrome + login)
  let web;
  try {
    web = await askChatGPT(prompt, { mode, profileDir: flags.profile });
  } catch (e) {
    const msg = { error: 'web_reasoning_failed', message: String(e.message || e) };
    if (json) return out(msg);
    console.error(msg.message);
    process.exit(5);
  }

  // 6. parse + validate result
  const result = parseResult(web.answer, packet.packet_id);
  const rv = validateResult(result, packet.packet_id);

  // 7. adoption gate
  const adoptionPlan = buildAdoptionPlan(result, { cwd });
  const untrusted = assertUntrusted();

  // 8. receipt
  const receipt = makeReceipt({
    packet: sanitized,
    result,
    browserEvidence: web.evidence,
    runState: { mode, cwd, approxTokens, packet_valid: v.ok, result_valid: rv.ok },
  });

  const final = {
    packet_id: packet.packet_id,
    objective: task,
    approxTokens,
    result,
    adoption_plan: adoptionPlan,
    untrusted_guard: untrusted,
    receipt: { receipt_id: receipt.receipt_id, file: receipt.file },
    principle: PRINCIPLE,
  };
  if (json) return out(final);
  console.log(JSON.stringify(final, null, 2));
}

async function cmdLogin() {
  const doctor = runDoctor();
  const browserCheck = doctor.checks.find((c) => c.name === 'browser');
  if (!browserCheck || !browserCheck.ok) {
    console.error('未找到系统浏览器（Edge 或 Chrome）。请先安装浏览器或设置 EDGE_PATH / CHROME_PATH。');
    process.exit(1);
  }
  try {
    const r = await loginFlow({ timeoutMs: 600000 });
    out(r);
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(5);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  const flags = args.flags;

  switch (cmd) {
    case 'version':
    case '--version':
    case '-v':
      console.log(`workbuddy-bridge-chatgpt ${VERSION}`);
      return;
    case 'doctor':
      return cmdDoctor();
    case 'consent':
      return cmdConsent(args._[1]);
    case 'validate':
      return cmdValidate();
    case 'login':
      return cmdLogin();
    case 'ask':
      return cmdAsk(flags);
    default:
      console.log(`workbuddy-bridge-chatgpt ${VERSION}
用法:
  wbc doctor [--json]                      预检环境
  wbc consent [enable|disable|status]     风险同意管理
  wbc validate                            自检契约管线
  wbc login                               打开浏览器登录 ChatGPT（仅首次/重新登录需要）
  wbc ask --task "<任务>" [--files a,b] [--test "<cmd>"] [--mode temporary|saved] [--dry-run] [--json]
`);
      process.exit(cmd ? 2 : 0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
