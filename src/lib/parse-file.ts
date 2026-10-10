import { MAX_BYTES } from "./analysis-core";

export interface ParsedFile {
  filename: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

export async function parseFeedbackFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  if (file.size === 0) throw new Error("This file is empty.");
  if (file.size > MAX_BYTES) throw new Error("This file is larger than 10 MB. Please split it and try again.");
  let rows: Record<string, unknown>[] = [];
  if (name.endsWith(".csv")) {
    const Papa = (await import("papaparse")).default;
    const text = await readText(file);
    const res = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
    if (res.errors.length && res.data.length === 0) throw new Error("We couldn't read this CSV. Check that it has a header row.");
    rows = res.data;
  } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    let wb: ReturnType<typeof XLSX.read>;
    try {
      wb = XLSX.read(await readBuffer(file), { type: "array" });
    } catch {
      throw new Error("We couldn't open this spreadsheet. It may be damaged or password-protected.");
    }
    const first = wb.SheetNames[0];
    const sheet = first ? wb.Sheets[first] : undefined;
    if (!sheet) throw new Error("This workbook has no sheets.");
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  } else {
    throw new Error("Please upload a .csv or .xlsx file.");
  }
  rows = rows.filter((r) => Object.values(r).some((v) => String(v ?? "").trim() !== ""));
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((c) => c && !c.startsWith("__EMPTY"));
  if (rows.length === 0 || columns.length === 0) throw new Error("No rows found. Make sure the first row contains column names.");
  return { filename: file.name, columns, rows };
}

/** Pick the review-text column: a name match first, else the longest non-numeric text. "" if none looks like free text. */
export function guessTextColumn(p: ParsedFile) {
  const sample = p.rows.slice(0, 200);
  const avgLen = (c: string) => sample.reduce((a, r) => a + String(r[c] ?? "").length, 0) / (sample.length || 1);
  const named = p.columns.find((c) => /review|feedback|comment|response|text|verbatim|body/i.test(c) && !/id$/i.test(c));
  if (named && avgLen(named) >= 3) return named;
  let best = "";
  let bestLen = 15; // shorter than this on average isn't review text
  for (const c of p.columns) {
    const vals = sample.map((r) => String(r[c] ?? ""));
    if (vals.filter((v) => v && !isNaN(Number(v))).length > vals.length / 2) continue;
    const avg = avgLen(c);
    if (avg > bestLen) {
      bestLen = avg;
      best = c;
    }
  }
  return best;
}

export function guessRatingColumn(p: ParsedFile) {
  return p.columns.find((c) => /rating|score|stars|nps/i.test(c)) ?? null;
}

const find = (p: ParsedFile, re: RegExp, exclude: string[] = []) => p.columns.find((c) => re.test(c) && !exclude.includes(c)) ?? null;
export const guessIdColumn = (p: ParsedFile) => find(p, /^(review[_ ]?)?id$|identifier|response[_ ]?id|review[_ ]?id/i);
export const guessCategoryColumn = (p: ParsedFile) => find(p, /category|product|segment|topic|channel/i);
export const guessDateColumn = (p: ParsedFile) => find(p, /date|time|created|submitted/i);

// Blob readers that also work outside the browser (tests).
function readBuffer(f: Blob): Promise<ArrayBuffer> {
  if (typeof f.arrayBuffer === "function") return f.arrayBuffer();
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as ArrayBuffer);
    r.onerror = () => rej(new Error("Could not read this file."));
    r.readAsArrayBuffer(f);
  });
}
async function readText(f: Blob) {
  return new TextDecoder().decode(await readBuffer(f));
}
