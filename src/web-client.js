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

async function waitForLoginIfNeeded(page) {
  const url = page.url();
  if (url.includes('/auth/') || url.includes('account.openai.com') || url.includes('login')) {
    console.error('[wbc] 检测到未登录，请在打开的浏览器中手动登录；登录后流程会自动继续…');
    await page.waitForURL('**/chat/**', { timeout: 300000 }).catch(() => {});
  }
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
    // Flags keep the automation profile quiet (suppress first-run / update nags),
    // which matters most for Microsoft Edge launched from a fresh profile.
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-features=Translate,OptimizationHints',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForLoginIfNeeded(page);

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
