// src/evidence.js
// Local repository evidence collector. All operations are read-only and local.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function git(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 15000,
    });
  } catch {
    return '';
  }
}

function readExcerpt(absPath, maxChars = 2000) {
  try {
    const s = fs.statSync(absPath);
    if (!s.isFile()) return { path: absPath, excerpt: '(skipped: not a file)' };
    if (s.size > 500000) return { path: absPath, excerpt: '(skipped: file too large)', size: s.size };
    const content = fs.readFileSync(absPath, 'utf8');
    return {
      path: absPath,
      excerpt: content.slice(0, maxChars),
      truncated: content.length > maxChars,
    };
  } catch (e) {
    return { path: absPath, excerpt: '', error: String(e && e.message || e) };
  }
}

/** @param {string} cwd */
export function isGitRepo(cwd) {
  return git(['rev-parse', '--is-inside-work-tree'], cwd).trim() === 'true';
}

/**
 * Collect decisive repository evidence for the Context Packet.
 * @param {object} opts
 * @param {string} [opts.cwd]
 * @param {string[]} [opts.files] relative file paths to include excerpts of
 * @param {string|null} [opts.testCommand] optional local test command to capture output
 * @param {number} [opts.diffMaxChars]
 * @param {number} [opts.logMax]
 */
export function collectEvidence({ cwd = process.cwd(), files = [], testCommand = null, diffMaxChars = 8000, logMax = 10 } = {}) {
  const repo = isGitRepo(cwd);
  const branch = repo ? git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd).trim() : 'n/a';
  const gitStatus = repo ? git(['status', '--short', '-b'], cwd) : 'not a git repository';
  const recentDiff = repo ? git(['--no-pager', 'diff', '-U3'], cwd).slice(0, diffMaxChars) : '';
  const recentLog = repo ? git(['--no-pager', 'log', '--oneline', '-n', String(logMax)], cwd) : '';
  const uncommittedStat = repo ? git(['--no-pager', 'diff', '--stat'], cwd) : '';

  const relevantFiles = (Array.isArray(files) ? files : [files])
    .filter(Boolean)
    .map((f) => readExcerpt(path.resolve(cwd, f)));

  let testResults = '';
  if (testCommand) {
    try {
      testResults = execFileSync(testCommand, {
        cwd,
        encoding: 'utf8',
        shell: true,
        timeout: 60000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      testResults = (e.stdout || '') + '\n' + (e.stderr || '') || String(e && e.message || e);
    }
    testResults = testResults.slice(0, 4000);
  }

  return {
    cwd,
    is_git_repo: repo,
    branch,
    git_status: gitStatus,
    recent_diff: recentDiff,
    recent_log: recentLog,
    uncommitted_stat: uncommittedStat,
    relevant_files: relevantFiles,
    test_results: testResults,
  };
}
