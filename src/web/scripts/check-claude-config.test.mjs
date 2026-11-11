// Tests for check-claude-config.mjs (spec 005, R3 and R4): npm run test:scripts
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { checkModelFile, checkRepo, checkTaskLabels } from './check-claude-config.mjs';

const skill = (model, effort) =>
  `---\nname: x\ndescription: y\n${model ? `model: ${model}\n` : ''}${effort ? `effort: ${effort}\n` : ''}---\n\n# x\n`;

describe('checkModelFile', () => {
  it('accepts a valid model and effort', () => {
    assert.deepEqual(checkModelFile('a', skill('haiku', 'low')), []);
  });

  it('reports a missing model and an unknown effort', () => {
    assert.deepEqual(checkModelFile('a', skill(null, 'turbo')), [
      'a: model must be one of haiku, sonnet, opus, inherit (got "")',
      'a: effort must be one of low, medium, high, xhigh, max (got "turbo")',
    ]);
  });

  it('reports a file without frontmatter', () => {
    assert.deepEqual(checkModelFile('a', '# no frontmatter'), ['a: no frontmatter']);
  });
});

describe('checkTaskLabels', () => {
  it('accepts labeled tasks, ticked or not', () => {
    const text = '- [ ] **T1 [haiku]: a**\n- [x] **T2 [opus]: b**\n  *To understand:* c';
    assert.deepEqual(checkTaskLabels('t', text), []);
  });

  it('reports a task without a label or with an unknown one', () => {
    const problems = checkTaskLabels('t', '- [ ] **T1: a**\n- [ ] **T2 [gpt]: b**');
    assert.equal(problems.length, 2);
    assert.match(problems[0], /task without a \[haiku\|sonnet\|opus\] label/);
  });
});

describe('checkRepo', () => {
  let root;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'blinker-claude-'));
    mkdirSync(join(root, '.claude', 'skills', 'plan'), { recursive: true });
    mkdirSync(join(root, '.claude', 'agents'), { recursive: true });
    writeFileSync(join(root, '.claude', 'skills', 'plan', 'SKILL.md'), skill('opus', 'high'));
    writeFileSync(join(root, '.claude', 'agents', 'r.md'), skill('haiku', 'medium'));
    for (const spec of ['002-old', '005-new']) {
      mkdirSync(join(root, 'docs', 'specs', spec), { recursive: true });
      writeFileSync(join(root, 'docs', 'specs', spec, 'tasks.md'), '- [ ] **T1: unlabeled**');
    }
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('exempts specs before 005 and reports unlabeled tasks from 005 on', () => {
    const problems = checkRepo(root);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /^docs\/specs\/005-new\/tasks\.md: task without/);
  });

  it('passes on this repository', () => {
    assert.deepEqual(checkRepo(resolve(import.meta.dirname, '..', '..', '..')), []);
  });
});
