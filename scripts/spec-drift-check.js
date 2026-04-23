#!/usr/bin/env node
/**
 * spec-drift-check.js
 *
 * Pre-commit warning (NOT a block) that fires when files under
 * src/modules/<module>/ are staged but the module's spec.md is not.
 *
 * Installed via simple-git-hooks: { "pre-commit": "node scripts/spec-drift-check.js" }
 *
 * Exit code is always 0 — this hook warns but never blocks commits.
 * This is intentional: hard blocks break agentic commit workflows.
 */

const { execSync } = require('node:child_process');

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    // Not in a git repo or no staged files — exit cleanly
    return [];
  }
}

function main() {
  const staged = getStagedFiles();

  if (staged.length === 0) {
    process.exit(0);
  }

  // Find all modules that have staged files
  const modulePattern = /^src\/modules\/([^/]+)\//;
  const touchedModules = new Set();

  for (const file of staged) {
    const match = file.match(modulePattern);
    if (match) {
      touchedModules.add(match[1]);
    }
  }

  if (touchedModules.size === 0) {
    process.exit(0);
  }

  // For each touched module, check whether spec.md is also staged
  let warned = false;

  for (const mod of touchedModules) {
    const specPath = `src/modules/${mod}/spec.md`;
    const specIsStaged = staged.includes(specPath);

    if (!specIsStaged) {
      console.warn(
        `\n⚠️  Module files changed in src/modules/${mod}/ but spec.md was not updated.` +
          `\n   Remember to keep spec.md in sync with code changes.` +
          `\n   Path: ${specPath}\n`,
      );
      warned = true;
    }
  }

  if (warned) {
    console.warn(
      '⚠️  spec-drift-check: warning(s) above are advisory — commit is NOT blocked.\n' +
        '   Update spec.md when your changes alter module responsibilities, public API,\n' +
        '   or performance budget.\n',
    );
  }

  // Always exit 0 — warnings only, never block
  process.exit(0);
}

main();
