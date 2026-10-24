// src/doctor.js
// Preflight checks: Node version, playwright-core, system Chrome, login state, consent.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { getConsent } from './consent.js';
import { stateDir } from './paths.js';

/** @returns {{name:string, ok:boolean, detail:string}} */
export function checkNode() {
  const v = process.versions.node;
  const major = Number(v.split('.')[0]);
  return { name: 'node', ok: major >= 18, detail: `v${v} (需要 >=18)` };
}

export function checkPlaywrightCore() {
  try {
    // module already imported at top; verify chromium exists
    return { name: 'playwright-core', ok: !!chromium, detail: 'resolved' };
  } catch (e) {
    return { name: 'playwright-core', ok: false, detail: String(e) };
  }
}

/**
 * Resolve a usable Chrome executable.
 * Priority: CHROME_PATH env > playwright-core expected path (if present) > common system locations.
 * @returns {string|null}
 */
export function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  try {
    const p = chromium.executablePath();
    if (p && fs.existsSync(p)) return p;
  } catch {}
  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/microsoft-edge',
  '/usr/bin/microsoft-edge-stable',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];

/**
 * Resolve a usable Microsoft Edge executable. Honors EDGE_PATH first.
 * @returns {string|null}
 */
export function findEdge() {
  if (process.env.EDGE_PATH && fs.existsSync(process.env.EDGE_PATH)) {
    return process.env.EDGE_PATH;
  }
  for (const c of EDGE_CANDIDATES) if (fs.existsSync(c)) return c;
  return null;
}

/**
 * Unified browser resolver. Supports Chrome and Microsoft Edge.
 * `WBC_BROWSER` env: 'auto' (default) | 'edge' | 'chrome'.
 * - 'auto': prefer Edge if present, else Chrome.
 * - 'edge' / 'chrome': restrict to that engine.
 * @returns {{path:string|null, name:'edge'|'chrome'|null}}
 */
export function findBrowser() {
  const env = (process.env.WBC_BROWSER || 'auto').toLowerCase();
  if (env === 'chrome') {
    const p = findChrome();
    return { path: p, name: p ? 'chrome' : null };
  }
  if (env === 'edge') {
    const p = findEdge();
    return { path: p, name: p ? 'edge' : null };
  }
  // auto
  const e = findEdge();
  if (e) return { path: e, name: 'edge' };
  const c = findChrome();
  if (c) return { path: c, name: 'chrome' };
  return { path: null, name: null };
}

export function checkChrome() {
  const p = findChrome();
  return { name: 'chrome', ok: !!p, detail: p || '未找到系统 Chrome，请设置 CHROME_PATH 或安装 Chrome' };
}

export function checkBrowser() {
  const { path: p, name } = findBrowser();
  return {
    name: 'browser',
    ok: !!p,
    detail: p
      ? `检测到 ${name === 'edge' ? 'Microsoft Edge' : 'Chrome'}：${p}`
      : '未找到系统浏览器（Edge 或 Chrome）。请设置 EDGE_PATH / CHROME_PATH，或安装浏览器后重试。',
  };
}

/**
 * Detect an existing logged-in browser profile (cookie storage).
 * @param {string} profileDir
 */
export function checkLogin(profileDir) {
  const cookiePaths = ['Cookies', 'Network/Cookies'];
  const ok = cookiePaths.some((rel) => fs.existsSync(path.join(profileDir, rel)));
  return {
    name: 'chatgpt_login',
    ok,
    detail: ok ? '检测到浏览器 profile（含登录态）' : '未发现登录态，首次运行请执行 ask 并手动登录',
  };
}

/**
 * Run all preflight checks.
 * @param {{profileDir?:string}} [opts]
 */
export function runDoctor({ profileDir } = {}) {
  const dir = profileDir || stateDir('browser-profile');
  const consent = getConsent();
  const checks = [
    checkNode(),
    checkPlaywrightCore(),
    checkBrowser(),
    checkLogin(dir),
  ];
  const consentCheck = {
    name: 'risk_consent',
    ok: consent.enabled,
    detail: consent.enabled
      ? `已同意（v${consent.consent_version}）`
      : '尚未授权自动化，请运行 `node src/cli.js consent enable`',
  };
  checks.push(consentCheck);
  const allOk = checks.every((c) => c.ok);
  return { ok: allOk, checks, consent, browser_path: findBrowser().path };
}

export function formatDoctor(result) {
  const lines = result.checks.map((c) => `${c.ok ? '✅' : '❌'} ${c.name}: ${c.detail}`);
  lines.push('');
  lines.push(result.ok ? 'ALL OK' : 'ACTION REQUIRED');
  return lines.join('\n');
}
