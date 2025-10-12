/*
 * Safe auto-fixes for a few common lint issues:
 * 1) Add radix 10 to parseInt(x, 10) occurrences that don't already include a radix.
 * 2) Remove unnecessary escaping of forward slashes inside strings ("/" -> "/").
 *
 * Run: node scripts/auto-fix-lint-safe.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXCLUDE = ['node_modules', '.git', 'coverage', 'dist', 'build'];
const FILE_EXT = ['.js', '.mjs', '.cjs'];

function shouldSkip(filePath) {
  return EXCLUDE.some(ex => filePath.includes(path.sep + ex + path.sep));
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (shouldSkip(full)) continue;
    if (ent.isDirectory()) walk(full);
    else if (FILE_EXT.includes(path.extname(ent.name))) processFile(full);
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // 1) Add radix to parseInt(..., 10) when there is no second argument
  // This will match parseInt(<something>, 10) but NOT parseInt(a, 10) or parseInt(a , 16)
  // We'll try to avoid matching things with comma inside parentheses.
  content = content.replace(/\bparseInt\(([^)]+)\)/g, (match, inner) => {
    // If inner contains a comma already, skip
    if (/,/.test(inner)) return match;
    // Heuristic: if inner contains 'parseInt' (nested) or 'function' skip
    if (/parseInt\s*\(|function\s*\(/.test(inner)) return match;
    // Add radix 10
    return `parseInt(${inner.trim(, 10)}, 10)`;
  });

  // 2) Remove unnecessary escaping of forward slash in strings: "/" -> "/"
  // We will replace occurrences of \\/ inside single or double quoted strings.
  // Simple approach: replace all occurrences of / with /; this is usually safe in JS strings.
  content = content.replace(/\\//g, '/');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Patched:', filePath);
  }
}

console.log('Running safe lint fixes from', ROOT);
walk(ROOT);
console.log('Done.');
