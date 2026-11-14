#!/usr/bin/env node
/**
 * gen-assets.mjs — writes asset-manifest.json (the list of files the service worker caches) and stamps a content
 * hash into sw.js. Run it after ANY change to a shipped game file:   node tools/gen-assets.mjs
 *   node tools/gen-assets.mjs --check    exits 1 if the committed manifest/sw.js are out of date (used by the tests)
 * The pre-commit hook in .githooks/ runs it for you:  git config core.hooksPath .githooks
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SHIP_DIRS = ['css', 'src', 'icons'];
const SHIP_FILES = ['index.html', 'manifest.webmanifest'];

function walk(dir, out) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

export function collect() {
  const files = [...SHIP_FILES];
  for (const d of SHIP_DIRS) for (const p of walk(join(ROOT, d), [])) files.push(relative(ROOT, p).split(sep).join('/'));
  return files.sort();
}

export function build() {
  const files = collect();
  const h = createHash('sha256');
  for (const f of files) { h.update(f); h.update('\0'); h.update(readFileSync(join(ROOT, f))); h.update('\0'); }
  const hash = h.digest('hex').slice(0, 10);
  const meta = readFileSync(join(ROOT, 'src/data/meta.js'), 'utf8');
  const ver = (meta.match(/VERSION = '([^']+)'/) || [])[1] || '0';
  const version = `${ver}-${hash}`;
  return { files, version, hash };
}

const { files, version, hash } = build();
const manifest = JSON.stringify({ version, files }, null, 2) + '\n';
const swPath = join(ROOT, 'sw.js');
const sw = readFileSync(swPath, 'utf8');
const swNew = sw.replace(/const BUILD = '[^']*';/, `const BUILD = '${hash}';`);

if (process.argv.includes('--check')) {
  let cur = '';
  try { cur = readFileSync(join(ROOT, 'asset-manifest.json'), 'utf8'); } catch (_) { /* missing */ }
  const ok = cur === manifest && sw === swNew;
  console.log(ok ? `assets up to date (${version}, ${files.length} files)` : 'STALE: run  node tools/gen-assets.mjs');
  process.exit(ok ? 0 : 1);
}
writeFileSync(join(ROOT, 'asset-manifest.json'), manifest);
writeFileSync(swPath, swNew);
console.log(`asset-manifest.json: ${files.length} files, version ${version}`);
