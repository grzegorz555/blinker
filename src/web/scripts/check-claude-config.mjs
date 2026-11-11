// Checks the model routing config (spec 005, R3 and R4):
// - every skill (.claude/skills/*/SKILL.md) and agent (.claude/agents/*.md) sets a valid `model` and `effort`;
// - every task in docs/specs/NNN-*/tasks.md (NNN >= 005, when the labels were introduced) has a difficulty label.
// No dependencies on purpose. Usage: node scripts/check-claude-config.mjs [repo root]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MODELS = ['haiku', 'sonnet', 'opus', 'inherit'];
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
export const LABELS = ['haiku', 'sonnet', 'opus'];
export const FIRST_LABELED_SPEC = 5;

/** Reads `key: value` pairs from the YAML frontmatter (flat keys only, which is all we need). */
export function frontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (pair) fields[pair[1]] = pair[2].trim().replace(/^["']|["']$/g, '');
  }
  return fields;
}

/** Problems with the `model` and `effort` of one skill or agent file. */
export function checkModelFile(name, text) {
  const fields = frontmatter(text);
  if (!fields) return [`${name}: no frontmatter`];
  const problems = [];
  if (!MODELS.includes(fields.model ?? '')) {
    problems.push(
      `${name}: model must be one of ${MODELS.join(', ')} (got "${fields.model ?? ''}")`,
    );
  }
  if (!EFFORTS.includes(fields.effort ?? '')) {
    problems.push(
      `${name}: effort must be one of ${EFFORTS.join(', ')} (got "${fields.effort ?? ''}")`,
    );
  }
  return problems;
}

/** Problems with the task labels of one tasks.md. */
export function checkTaskLabels(name, text) {
  const tasks = text.split(/\r?\n/).filter((line) => /^- \[[ x]\] \*\*T\d+/.test(line));
  const label = new RegExp(String.raw`^- \[[ x]\] \*\*T\d+ \[(${LABELS.join('|')})\]`);
  return tasks
    .filter((line) => !label.test(line))
    .map((line) => `${name}: task without a [${LABELS.join('|')}] label: ${line.slice(0, 60)}`);
}

export function checkRepo(root) {
  const rel = (p) => relative(root, p).split(sep).join('/');
  const problems = [];
  const skillsDir = join(root, '.claude', 'skills');
  for (const skill of existsSync(skillsDir) ? readdirSync(skillsDir) : []) {
    const file = join(skillsDir, skill, 'SKILL.md');
    if (existsSync(file)) problems.push(...checkModelFile(rel(file), readFileSync(file, 'utf8')));
  }
  const agentsDir = join(root, '.claude', 'agents');
  for (const agent of existsSync(agentsDir) ? readdirSync(agentsDir) : []) {
    if (!agent.endsWith('.md')) continue;
    const file = join(agentsDir, agent);
    problems.push(...checkModelFile(rel(file), readFileSync(file, 'utf8')));
  }
  const specsDir = join(root, 'docs', 'specs');
  for (const spec of existsSync(specsDir) ? readdirSync(specsDir) : []) {
    const number = Number(/^(\d{3})-/.exec(spec)?.[1]);
    const file = join(specsDir, spec, 'tasks.md');
    if (number >= FIRST_LABELED_SPEC && existsSync(file)) {
      problems.push(...checkTaskLabels(rel(file), readFileSync(file, 'utf8')));
    }
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? join(import.meta.dirname, '..', '..', '..'));
  const problems = checkRepo(root);
  if (problems.length) {
    console.error(`Claude config check failed (${problems.length}):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log('Claude config check passed');
}
