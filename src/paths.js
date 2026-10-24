// src/paths.js
// Resolve the package root and its private state directory.
// State (consent config, browser profile, debug bundles) is anchored to the
// package install location — NOT the current working directory — so the tool
// behaves identically no matter which project directory invokes it (important
// for a globally-installed WorkBuddy Skill).
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PKG_ROOT = path.resolve(__dirname, '..');
export const STATE_ROOT = path.join(PKG_ROOT, '.workbuddy-bridge');

/** Join segments under the package-local state directory. */
export function stateDir(...segs) {
  return path.join(STATE_ROOT, ...segs);
}
