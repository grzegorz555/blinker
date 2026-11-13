// Spec 006, T1 (R1): his board in the app (public/boards/friend-pl.json) equals the transcription of the paper board
// (docs/boards/friend-board.md), cell by cell. He knows the board by heart, so a difference would make him miscount.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const webDir = resolve(import.meta.dirname, '..');
const json = JSON.parse(
  readFileSync(resolve(webDir, 'public', 'boards', 'friend-pl.json'), 'utf8'),
);
const markdown = readFileSync(
  resolve(webDir, '..', '..', 'docs', 'boards', 'friend-board.md'),
  'utf8',
);

/** The rows of the "row \ column" table: "| **1** | A | B | … |", with "*(empty)*" as null. */
function readTable(md) {
  return md
    .split('\n')
    .filter((line) => /^\| \*\*\d+\*\* \|/.test(line))
    .map((line) =>
      line
        .split('|')
        .slice(2, -1)
        .map((cell) => cell.trim())
        .map((cell) => (cell === '*(empty)*' ? null : cell)),
    );
}

describe('his board: friend-pl.json equals friend-board.md', () => {
  const table = readTable(markdown);

  it('the Markdown table has 5 rows of 7 cells', () => {
    assert.equal(table.length, 5);
    for (const row of table) assert.equal(row.length, 7);
  });

  it('every cell is the same, in the same place', () => {
    const cells = json.cells.map((row) => row.map((cell) => cell?.value ?? null));
    assert.deepEqual(cells, table);
  });

  it('every letter is a char cell, the labels are 1–7 and 1–5', () => {
    assert.ok(json.cells.flat().every((cell) => cell === null || cell.type === 'char'));
    assert.deepEqual(json.columns, ['1', '2', '3', '4', '5', '6', '7']);
    assert.deepEqual(json.rows, ['1', '2', '3', '4', '5']);
  });

  it('detects a difference (negative test)', () => {
    const swapped = readTable(markdown.replace('| **2** | H |', '| **2** | X |'));
    const cells = json.cells.map((row) => row.map((cell) => cell?.value ?? null));
    assert.notDeepEqual(cells, swapped);
  });
});
