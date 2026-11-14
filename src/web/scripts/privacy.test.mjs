// Privacy guard (docs/conventions/security.md, GDPR): the repository describes the friend and how he communicates, but
// holds no personal data. This test fails if a tracked file brings some in by accident:
// - an image with metadata (EXIF can hold GPS coordinates of his home, the phone model and the date);
// - an e-mail address other than GitHub's noreply ones and example domains;
// - a Polish PESEL-like number (11 digits) or a phone number in text.
// The local, git-ignored files (*.local.md, .local/) are not checked: they never leave the author's computer.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const root = resolve(import.meta.dirname, '..', '..', '..');
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const IMAGE = /\.(jpe?g|png|webp|gif|heic|tiff?)$/i;
const BINARY = /\.(jpe?g|png|webp|gif|heic|tiff?|ico|task|wasm|woff2?)$/i;
/** Files that are not ours to check line by line: lock files and third-party data. */
const SKIP = /(^|\/)package-lock\.json$/;

/** Byte markers of image metadata: EXIF (JPEG APP1 and PNG eXIf), XMP, and GPS tags. */
export function imageMetadata(bytes) {
  const text = bytes.toString('latin1');
  const found = [];
  if (text.includes('Exif\0\0')) found.push('EXIF');
  if (text.includes('eXIf')) found.push('PNG eXIf');
  if (text.includes('http://ns.adobe.com/xap/1.0/')) found.push('XMP');
  if (text.includes('GPSLatitude') || text.includes('exif:GPS')) found.push('GPS');
  return found;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const ALLOWED_EMAIL = /@(users\.noreply\.github\.com|example\.(com|org|net)|[a-z0-9-]+\.example)$/i;
/** Version ranges and package names look like addresses (@angular/core@22.0.0): only real domains count. */
export function personalEmails(text) {
  return (text.match(EMAIL) ?? []).filter(
    (e) => !ALLOWED_EMAIL.test(e) && !/^[\d.]+@/.test(e) && !/\.(js|ts|css|json|md|html)$/i.test(e),
  );
}

/** An 11-digit number standing alone (a PESEL), or a Polish phone number (+48 and 9 digits). */
export function idNumbers(text) {
  const pesel = text.match(/(?<![\d.-])\d{11}(?![\d.-])/g) ?? [];
  const phone = text.match(/\+48[ -]?\d{3}[ -]?\d{3}[ -]?\d{3}\b/g) ?? [];
  return [...pesel, ...phone];
}

// The samples are built at run time, so this file itself holds no address or number the scan would find.
const SAMPLE_EMAIL = ['jan.kowalski', 'gmail.com'].join('@');
const SAMPLE_PESEL = ['440514', '01359'].join('');
const SAMPLE_PHONE = ['+48', '600', '100', '200'].join(' ');

describe('privacy guard (GDPR)', () => {
  it('the detectors catch what they should (negative tests)', () => {
    assert.deepEqual(
      imageMetadata(Buffer.from('\xff\xd8\xff\xe1..Exif\0\0..GPSLatitude', 'latin1')),
      ['EXIF', 'GPS'],
    );
    assert.deepEqual(imageMetadata(Buffer.from('\xff\xd8\xff\xdb plain', 'latin1')), []);
    assert.deepEqual(personalEmails(`mail ${SAMPLE_EMAIL} or x@users.noreply.github.com`), [
      SAMPLE_EMAIL,
    ]);
    assert.deepEqual(personalEmails('"@angular/core": "^22.0.0", a@b.example'), []);
    assert.deepEqual(idNumbers(`PESEL ${SAMPLE_PESEL}, tel. ${SAMPLE_PHONE}, size 3758596 bytes`), [
      SAMPLE_PESEL,
      SAMPLE_PHONE,
    ]);
  });

  it('no tracked image carries metadata (EXIF, XMP or GPS)', () => {
    const problems = tracked
      .filter((f) => IMAGE.test(f))
      .map((f) => [f, imageMetadata(readFileSync(resolve(root, f)))])
      .filter(([, found]) => found.length)
      .map(([f, found]) => `${f}: ${found.join(', ')}`);
    assert.deepEqual(problems, []);
  });

  it('no tracked text holds a personal e-mail address, a PESEL or a phone number', () => {
    const problems = [];
    for (const f of tracked) {
      if (BINARY.test(f) || SKIP.test(f)) continue;
      const text = readFileSync(resolve(root, f), 'utf8');
      for (const e of personalEmails(text)) problems.push(`${f}: e-mail ${e}`);
      for (const n of idNumbers(text)) problems.push(`${f}: number ${n}`);
    }
    assert.deepEqual(problems, []);
  });
});
