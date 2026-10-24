// src/consent.js
// Versioned, explicit risk consent for ChatGPT Web automation.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CONSENT_VERSION = '1.0.0';
const CONFIG_DIR = path.resolve(__dirname, '..', '.workbuddy-bridge');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

/** @returns {Record<string, any>} */
export function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export function writeConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

/**
 * Read current consent state, accounting for version drift.
 * A stale (version-mismatched) config is treated as not-enabled.
 */
export function getConsent() {
  const cfg = readConfig();
  if (cfg.consent_version !== CONSENT_VERSION) {
    return {
      status: 'stale',
      enabled: false,
      consent_version: cfg.consent_version ?? null,
      current_version: CONSENT_VERSION,
    };
  }
  return {
    status: cfg.automation_enabled ? 'enabled' : 'disabled',
    enabled: !!cfg.automation_enabled,
    consent_version: CONSENT_VERSION,
  };
}

/**
 * Set automation consent.
 * @param {boolean} enabled
 */
export function setConsent(enabled) {
  const cfg = readConfig();
  cfg.consent_version = CONSENT_VERSION;
  cfg.automation_enabled = !!enabled;
  writeConfig(cfg);
  return getConsent();
}

export const DISCLOSURE = [
  'workbuddy-bridge-chatgpt 将通过 playwright-core 驱动你已登录的 ChatGPT Web 会话，',
  '以"粘贴上下文 → 提交 → 复制回答"的方式复用你的订阅额度做推理卸载。',
  '',
  '风险披露：',
  '1. 这是对 ChatGPT Web 的非官方自动化，可能触发平台风控、临时限制或账号处置。',
  '2. 浏览器登录态 profile 存于本地 .workbuddy-bridge/browser-profile，请勿分享或提交到版本库。',
  '3. 出站 Context Packet 会经过密钥扫描与压缩，但不会发送完整私有仓库或无关上下文。',
  '4. ChatGPT 的回答一律视为不可信数据，WorkBuddy 会在本地采纳门内重验后才执行。',
  '',
  '输入 enable 表示你已理解上述风险并授权自动化；disable 可随时撤销。',
].join('\n');
