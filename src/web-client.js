// src/web-client.js
// Playwright (playwright-core + system Edge/Chrome) driver for ChatGPT Web.
// Drives an already-logged-in chatgpt.com session: paste prompt -> submit -> wait -> extract.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { findBrowser, findChrome } from './doctor.js';
import { stateDir } from './paths.js';

const SELECTORS = {
  textarea: process.env.WBC_TEXTAREA_SELECTOR || 'textarea',
  sendButton: process.env.WBC_SEND_BUTTON_SELECTOR || 'button[data-testid="send-button"]',
  assistantMessages: process.env.WBC_ASSISTANT_SELECTOR || '[data-message-author-role="assistant"]',
};

/**
 * Resolve a usable browser executable (Edge or Chrome).
 * Priority: WBC_BROWSER env ('auto'|'edge'|'chrome'), then explicit
 * EDGE_PATH / CHROME_PATH, then auto-detected system locations.
 * @returns {string|null}
 */
export function resolveBrowserPath() {
  const { path: p } = findBrowser();
  if (p) return p;
  // fallback: playwright-core bundled chromium (if installed)
  try {
    const bundled = chromium.executablePath();
    if (bundled && fs.existsSync(bundled)) return bundled;
  } catch {}
  return null;
}

// Kept for backward compatibility.
export function resolveChromePath() {
  return resolveBrowserPath();
}

// Flags keep the automation profile quiet (suppress first-run / update nags),
// which matters most for Microsoft Edge launched from a fresh profile.
const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--disable-features=Translate,OptimizationHints',
];

/**
 * Block until the ChatGPT session is logged in.
 *
 * FIX for the "login window flashes and closes" bug: the previous code sampled
 * page.url() once right after goto, which missed ChatGPT's *async* redirect to a
 * login page and then timed out waiting for a `textarea` that does not exist on the
 * login page — causing the browser to close. Here we poll the DOM instead:
 *   - a present `textarea`  => already logged in
 *   - an email/password field or a "Log in"/"登录" button => on a login page
 * When on a login page we KEEP THE BROWSER OPEN and wait for the user to
 * authenticate (up to timeoutMs). We never close the browser while waiting.
 *
 * @param {import('playwright-core').Page} page
 * @param {{timeoutMs?:number}} [opts]
 */
export async function ensureLoggedIn(page, { timeoutMs = 600000 } = {}) {
  console.error('[wbc] 正在检查 ChatGPT 登录态…');
  const deadline = Date.now() + timeoutMs;
  let loginHintShown = false;
  while (Date.now() < deadline) {
    const state = await page
      .evaluate(() => {
        if (document.querySelector('textarea')) return 'in';
        const cred = document.querySelector('input[type="email"], input[name="email"], input[type="password"]');
        if (cred) return 'login';
        const btns = Array.from(document.querySelectorAll('button'));
        const hasLogin = btns.some((b) => /log\s?in|sign\s?in|登录|登入/i.test(b.textContent || ''));
        return hasLogin ? 'login' : 'unknown';
      })
      .catch(() => 'unknown');
    if (state === 'in') {
      console.error('[wbc] 已检测到登录态，继续。');
      return;
    }
    if (state === 'login' && !loginHintShown) {
      loginHintShown = true;
      console.error('[wbc] 检测到未登录：请在打开的浏览器窗口中完成登录。窗口将保持打开，登录成功后会自动继续…');
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(
    `登录等待超时（${Math.round(timeoutMs / 1000)}s）。请在浏览器中手动登录后重试，或运行 \`wbc login\` 单独登录。`
  );
}

function writeDebugBundle(browser, err) {
  const bundleDir = stateDir('debug');
  fs.mkdirSync(bundleDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bundle = { error: String((err && err.stack) || err), selectors: SELECTORS };
  fs.writeFileSync(path.join(bundleDir, `debug-${stamp}.json`), JSON.stringify(bundle, null, 2));
  try {
    const page = browser.contexts()[0] && browser.contexts()[0].pages()[0];
    if (page) page.screenshot({ path: path.join(bundleDir, `debug-${stamp}.png`), fullPage: false }).catch(() => {});
  } catch {}
  return path.join(bundleDir, `debug-${stamp}.json`);
}

/**
 * Send a prompt to ChatGPT Web and return the latest assistant answer.
 * @param {string} promptText
 * @param {object} [opts]
 * @param {'temporary'|'saved'} [opts.mode]
 * @param {string} [opts.profileDir]
 * @param {number} [opts.timeoutMs]
 * @param {boolean} [opts.headless]
 */
export async function askChatGPT(promptText, { mode = 'temporary', profileDir, timeoutMs = 180000, headless = false } = {}) {
  const executablePath = resolveBrowserPath();
  if (!executablePath) {
    throw new Error('未找到系统浏览器（Edge 或 Chrome）。请设置 EDGE_PATH / CHROME_PATH，或安装浏览器后重试。');
  }
  const userDataDir = profileDir || stateDir('browser-profile');
  fs.mkdirSync(userDataDir, { recursive: true });

  // 'temporary' mode: open a temporary chat so the session leaves no persistent memory.
  const targetUrl = mode === 'temporary' ? 'https://chatgpt.com/?temporary-chat=true' : 'https://chatgpt.com/';

  const browser = await chromium.launchPersistentContext(userDataDir, {
    executablePath,
    headless,
    args: LAUNCH_ARGS,
  });

  try {
    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ensureLoggedIn(page);

    await page.waitForSelector(SELECTORS.textarea, { timeout: 30000 });
    await page.fill(SELECTORS.textarea, promptText);

    let submitted = false;
    try {
      const btn = await page.$(SELECTORS.sendButton);
      if (btn) {
        await btn.click();
        submitted = true;
      }
    } catch {}
    if (!submitted) {
      await page.press(SELECTORS.textarea, 'Enter');
    }

    // Wait until the latest assistant message stops streaming.
    await page
      .waitForFunction(
        () => {
          const nodes = document.querySelectorAll('[data-message-author-role="assistant"]');
          if (!nodes.length) return false;
          const last = nodes[nodes.length - 1];
          const spin = last.querySelector('[data-testid="loading-indicator"], button[aria-label*="Stop"], .result-thinking');
          return !spin;
        },
        { timeout: timeoutMs }
      )
      .catch(() => {});

    const answer = await page.evaluate((sel) => {
      const nodes = document.querySelectorAll(sel);
      if (!nodes.length) return '';
      return nodes[nodes.length - 1].innerText || '';
    }, SELECTORS.assistantMessages);

    const evidence = {
      url: page.url(),
      mode,
      answer_len: answer.length,
      captured_at: new Date().toISOString(),
    };
    return { answer: answer.trim(), evidence };
  } catch (err) {
    const bundle = writeDebugBundle(browser, err);
    throw new Error(`Web 推理失败，已导出调试包到 ${bundle} ： ${err && err.message || err}`);
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Standalone login flow: open the browser, keep it open until the user logs in,
 * then close and persist the session. Separates "first-time login" from "ask",
 * so the login window never flashes-and-closes during normal use.
 * @param {{profileDir?:string, timeoutMs?:number}} [opts]
 */
export async function loginFlow({ profileDir, timeoutMs = 600000 } = {}) {
  const executablePath = resolveBrowserPath();
  if (!executablePath) {
    throw new Error('未找到系统浏览器（Edge 或 Chrome）。请设置 EDGE_PATH / CHROME_PATH，或安装浏览器后重试。');
  }
  const userDataDir = profileDir || stateDir('browser-profile');
  fs.mkdirSync(userDataDir, { recursive: true });

  console.error('[wbc] 打开浏览器，请在窗口中登录 ChatGPT（窗口将保持打开直到登录成功）…');
  const browser = await chromium.launchPersistentContext(userDataDir, {
    executablePath,
    headless: false, // login MUST be visible
    args: LAUNCH_ARGS,
  });
  try {
    const page = await browser.newPage();
    await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ensureLoggedIn(page, { timeoutMs });
    console.error('[wbc] 登录成功！浏览器 profile 已保存到 ' + userDataDir + '。可关闭窗口，之后运行 ask 会复用此登录态。');
    return { ok: true, url: page.url() };
  } finally {
    await browser.close().catch(() => {});
  }
}
