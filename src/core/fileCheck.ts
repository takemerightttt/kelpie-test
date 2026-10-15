// Local checks before anything is sent. They look at the bytes, never at the
// extension or the MIME type the picker reports, and they never read the whole
// file: the size comes from file metadata, the format from the first bytes.

export const MAX_BYTES = 10 * 1024 * 1024;

/** How many leading bytes are enough to recognise both formats. */
export const HEAD_BYTES = 32;

export type StatementFormat = "pdf" | "csv";

export type FileCheck =
  | { ok: true; format: StatementFormat }
  | { ok: false; reason: "empty" | "too_large" | "unsupported" };

const PDF_MAGIC = "%PDF-";
const CSV_HEADER = "date,description,amount\n";

function asciiPrefix(head: Uint8Array, length: number): string {
  let out = "";
  for (let index = 0; index < Math.min(length, head.length); index += 1)
    out += String.fromCharCode(head[index]);
  return out;
}

/** Same rules as the server: "%PDF-" at offset 0, or the exact CSV header line. */
export function detectFormat(head: Uint8Array): StatementFormat | null {
  if (asciiPrefix(head, PDF_MAGIC.length) === PDF_MAGIC) return "pdf";
  const text = asciiPrefix(head, HEAD_BYTES).replace(/\r/g, "");
  if (text.startsWith(CSV_HEADER)) return "csv";
  return null;
}

export function checkFile(size: number, head: Uint8Array): FileCheck {
  if (size <= 0) return { ok: false, reason: "empty" };
  if (size > MAX_BYTES) return { ok: false, reason: "too_large" };
  const format = detectFormat(head);
  return format ? { ok: true, format } : { ok: false, reason: "unsupported" };
}
