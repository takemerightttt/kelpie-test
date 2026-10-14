import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkFile, detectFormat, MAX_BYTES } from '../../src/core/fileCheck';
import { FIXTURES } from '../support/node';

const head = (name: string) => new Uint8Array(readFileSync(join(FIXTURES, name)).subarray(0, 32));
const bytes = (text: string) => new Uint8Array(Buffer.from(text, 'latin1'));

describe('local file check', () => {
  it('accepts the fixture PDF and CSV by their bytes', () => {
    expect(detectFormat(head('statement.pdf'))).toBe('pdf');
    expect(detectFormat(head('statement.csv'))).toBe('csv');
  });

  it('rejects spoofed.pdf: text with a .pdf name is not a PDF', () => {
    expect(checkFile(84, head('spoofed.pdf'))).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('rejects files over 10 MiB from metadata, before reading content', () => {
    expect(checkFile(MAX_BYTES + 1, bytes('%PDF-1.4'))).toEqual({ ok: false, reason: 'too_large' });
    expect(checkFile(MAX_BYTES, bytes('%PDF-1.4'))).toEqual({ ok: true, format: 'pdf' });
  });

  it('accepts a CSV with Windows line endings, rejects a CSV with another header', () => {
    expect(detectFormat(bytes('date,description,amount\r\n2026'))).toBe('csv');
    expect(detectFormat(bytes('when,what,amount\n'))).toBeNull();
  });

  it('rejects an empty file', () => {
    expect(checkFile(0, new Uint8Array())).toEqual({ ok: false, reason: 'empty' });
  });
});
