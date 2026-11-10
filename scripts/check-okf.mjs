#!/usr/bin/env node
// Checks that docs/ is a conformant OKF v0.2 bundle plus our stricter house rules.
// - every concept .md (not index.md / log.md / *.local.md) starts with YAML frontmatter containing a non-empty `type`
// - every concept is linked from the nearest index.md in its directory or an ancestor directory
// - every relative link in an index.md points to an existing file
// No dependencies on purpose: runs on plain Node in CI before any npm install.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? 'docs');
const RESERVED = new Set(['index.md', 'log.md']);
const errors = [];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const rel = (p) => relative(process.cwd(), p).split(sep).join('/');
const files = walk(root).filter((p) => p.endsWith('.md') && !p.endsWith('.local.md'));

function frontmatterType(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!match) return null;
  const line = match[1].split(/\r?\n/).find((l) => /^type:/.test(l));
  return line ? line.slice('type:'.length).trim().replace(/^["']|["']$/g, '') : null;
}

function linksIn(indexPath) {
  const text = readFileSync(indexPath, 'utf8');
  return [...text.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)]
    .map((m) => m[1])
    .filter((href) => !/^[a-z]+:/i.test(href))
    .map((href) => resolve(dirname(indexPath), href));
}

function nearestIndex(file) {
  let dir = dirname(file);
  while (dir.startsWith(root)) {
    const candidate = join(dir, 'index.md');
    if (existsSync(candidate) && candidate !== file) return candidate;
    if (dir === root) break;
    dir = dirname(dir);
  }
  return null;
}

const indexLinks = new Map();
for (const file of files.filter((f) => f.endsWith(`${sep}index.md`))) {
  const links = linksIn(file);
  indexLinks.set(file, new Set(links));
  for (const target of links) {
    if (!existsSync(target)) errors.push(`${rel(file)}: broken link to ${rel(target)}`);
  }
}

for (const file of files) {
  const name = file.split(sep).pop();
  if (RESERVED.has(name)) continue;
  const type = frontmatterType(readFileSync(file, 'utf8'));
  if (!type) errors.push(`${rel(file)}: missing frontmatter with a non-empty "type" (OKF §4)`);
  const index = nearestIndex(file);
  if (!index) errors.push(`${rel(file)}: no index.md found in this or a parent directory`);
  else if (!indexLinks.get(index)?.has(file)) errors.push(`${rel(file)}: not listed in ${rel(index)}`);
}

if (errors.length) {
  console.error(`OKF check failed (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`OKF check passed: ${files.length} files in ${rel(root) || '.'}`);
