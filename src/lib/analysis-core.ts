// Pure, deterministic helpers shared by server and client. No AI here:
// every count, percentage and quote check is computed from the uploaded rows.

export type Sentiment = "positive" | "neutral" | "negative";

export interface FeedbackRow {
  source_id: string;
  text: string;
  rating: number | null;
  category: string | null;
  date: string | null;
  sentiment: Sentiment | null;
  sentiment_score: number | null;
  keywords: string[];
}

export interface Evidence {
  source_id: string;
  quote: string;
}

export interface Theme {
  name: string;
  description: string;
  source_ids: string[];
  count: number;
  percent: number;
  sentiment: Record<Sentiment, number>;
  evidence: Evidence[];
}

export interface Recommendation {
  title: string;
  rationale: string;
  /** Possible cause — an AI hypothesis, not an established fact. */
  hypothesis: string;
  priority: "high" | "medium" | "low";
  themes: string[];
  evidence: Evidence[];
  supporting_rows: number;
}

export interface VerificationReport {
  quotes_proposed: number;
  quotes_verified: number;
  quotes_rejected: number;
  ids_rejected: number;
  themes_dropped: number;
  recommendations_dropped: number;
  rows_unanalysed: number;
}

export interface AnalysisResult {
  total: number;
  sentiment: { counts: Record<Sentiment, number>; percents: Record<Sentiment, number> };
  average_rating: number | null;
  keywords: { term: string; count: number; percent: number }[];
  themes: Theme[];
  recommendations: Recommendation[];
  verification: VerificationReport;
  summary: string;
  generated_at: string;
}

export const MAX_ROWS = 2000;
export const MAX_BYTES = 10 * 1024 * 1024;
export const MIN_CHARS = 3;
export const MAX_TEXT = 4000;

/** Percent with one decimal; largest-remainder so a group sums to exactly 100. */
export function percents<K extends string>(counts: Record<K, number>): Record<K, number> {
  const keys = Object.keys(counts) as K[];
  const total = keys.reduce((a, k) => a + counts[k], 0);
  const out = {} as Record<K, number>;
  if (total === 0) {
    keys.forEach((k) => (out[k] = 0));
    return out;
  }
  const scaled = keys.map((k) => {
    const raw = (counts[k] / total) * 1000;
    return { k, floor: Math.floor(raw), rem: raw - Math.floor(raw) };
  });
  let left = 1000 - scaled.reduce((a, s) => a + s.floor, 0);
  [...scaled].sort((a, b) => b.rem - a.rem).forEach((s) => {
    if (left > 0) {
      s.floor += 1;
      left -= 1;
    }
  });
  scaled.forEach((s) => (out[s.k] = s.floor / 10));
  return out;
}

export function pct(n: number, total: number) {
  return total === 0 ? 0 : Math.round((n / total) * 1000) / 10;
}

/** Quote must appear verbatim (exact substring) in the cited row. */
export function verifyQuote(rowsById: Map<string, FeedbackRow>, ev: Evidence): Evidence | null {
  const row = rowsById.get(String(ev.source_id ?? "").trim());
  if (!row) return null;
  const quote = String(ev.quote ?? "").trim().replace(/^["“”']+|["“”']+$/g, "").trim();
  if (quote.length < MIN_CHARS) return null;
  if (!row.text.includes(quote)) return null;
  return { source_id: row.source_id, quote };
}

export function sentimentCounts(rows: FeedbackRow[]): Record<Sentiment, number> {
  const c: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
  rows.forEach((r) => {
    if (r.sentiment) c[r.sentiment] += 1;
  });
  return c;
}

/** Keyword frequency = number of rows whose text contains the keyword. */
export function keywordStats(rows: FeedbackRow[], limit = 20) {
  const counts = new Map<string, number>();
  rows.forEach((r) => {
    const lower = r.text.toLowerCase();
    new Set(r.keywords.map((k) => k.toLowerCase().trim())).forEach((k) => {
      if (k && lower.includes(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
    });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term, count]) => ({ term, count, percent: pct(count, rows.length) }));
}

/** Keep only keywords that literally appear in the row. */
export function cleanKeywords(text: string, keywords: unknown) {
  if (!Array.isArray(keywords)) return [];
  const lower = text.toLowerCase();
  return [...new Set(keywords.filter((k): k is string => typeof k === "string").map((k) => k.toLowerCase().trim()))]
    .filter((k) => k.length >= 2 && k.length <= 40 && lower.includes(k))
    .slice(0, 6);
}

/** Stable short hash (FNV-1a) so generated IDs don't change between uploads of the same file. */
export function stableId(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `R-${(h >>> 0).toString(36).toUpperCase().padStart(7, "0")}`;
}

export interface ColumnMap {
  text: string;
  id?: string | null;
  rating?: string | null;
  category?: string | null;
  date?: string | null;
}

export interface PreparedRow {
  source_id: string;
  text: string;
  rating: number | null;
  category: string | null;
  date: string | null;
}

export interface PrepareStats {
  rows: PreparedRow[];
  empty: number;
  short: number;
  dupes: number;
  overflow: number;
  bad_ratings: number;
  ids_generated: number;
  duplicate_ids: number;
}

const cell = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

function normDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && v > 20000 && v < 80000) {
    // Excel serial date
    return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  }
  const s = cell(v);
  const d = new Date(s);
  return isNaN(d.getTime()) ? s.slice(0, 32) : d.toISOString().slice(0, 10);
}

/** Clean raw spreadsheet rows: trim, drop empty/short, drop duplicates, assign stable IDs, cap. */
export function prepareRows(raw: Record<string, unknown>[], map: ColumnMap): PrepareStats {
  const seenText = new Set<string>();
  const seenIds = new Set<string>();
  const s: PrepareStats = { rows: [], empty: 0, short: 0, dupes: 0, overflow: 0, bad_ratings: 0, ids_generated: 0, duplicate_ids: 0 };
  for (const r of raw) {
    const text = cell(r[map.text]);
    if (text.length === 0) {
      s.empty++;
      continue;
    }
    if (text.length < MIN_CHARS) {
      s.short++;
      continue;
    }
    const key = text.toLowerCase();
    if (seenText.has(key)) {
      s.dupes++;
      continue;
    }
    if (s.rows.length >= MAX_ROWS) {
      s.overflow++;
      continue;
    }
    seenText.add(key);

    let id = map.id ? cell(r[map.id]).replace(/[^\w.\-]/g, "").slice(0, 40) : "";
    if (id && seenIds.has(id)) {
      s.duplicate_ids++;
      id = "";
    }
    if (!id) {
      id = stableId(key);
      while (seenIds.has(id)) id = stableId(id + key);
      s.ids_generated++;
    }
    seenIds.add(id);

    let rating: number | null = null;
    if (map.rating) {
      const rv = cell(r[map.rating]);
      if (rv) {
        const n = Number(rv);
        if (Number.isFinite(n)) rating = n;
        else s.bad_ratings++;
      }
    }
    s.rows.push({
      source_id: id,
      text: text.slice(0, MAX_TEXT),
      rating,
      category: map.category ? cell(r[map.category]).slice(0, 60) || null : null,
      date: map.date ? normDate(r[map.date]) : null,
    });
  }
  return s;
}

// ---------- Validation of AI output (untrusted) ----------

export interface BatchItem {
  source_id: string;
  sentiment: Sentiment;
  sentiment_score: number;
  keywords: string[];
}

const SENTS = new Set(["positive", "neutral", "negative"]);

/** Keep only items that reference a row in this batch, once, with a valid sentiment. */
export function validateBatch(rows: { source_id: string; text: string }[], items: unknown): { results: BatchItem[]; rejected: number } {
  const byId = new Map(rows.map((r) => [r.source_id, r]));
  const seen = new Set<string>();
  const results: BatchItem[] = [];
  let rejected = 0;
  for (const it of Array.isArray(items) ? items : []) {
    const o = (it ?? {}) as Record<string, unknown>;
    const row = byId.get(String(o["source_id"] ?? "").trim());
    const sentiment = String(o["sentiment"] ?? "");
    const score = Number(o["score"] ?? o["sentiment_score"]);
    if (!row || seen.has(row.source_id) || !SENTS.has(sentiment)) {
      rejected++;
      continue;
    }
    seen.add(row.source_id);
    results.push({
      source_id: row.source_id,
      sentiment: sentiment as Sentiment,
      sentiment_score: Number.isFinite(score) ? Math.max(-1, Math.min(1, score)) : 0,
      keywords: cleanKeywords(row.text, o["keywords"]),
    });
  }
  return { results, rejected };
}

export interface SynthOutput {
  summary: string;
  themes: { name: string; description: string; source_ids: string[]; evidence: Evidence[] }[];
  recommendations: { title: string; rationale: string; hypothesis: string; priority: "high" | "medium" | "low"; themes: string[]; evidence: Evidence[] }[];
}

/**
 * Turn the AI's proposals into a result where every ID and quote is checked
 * against the original rows and every number is computed here.
 * Only rows with a validated sentiment count towards totals.
 */
export function buildResult(allRows: FeedbackRow[], out: SynthOutput, now = new Date()): AnalysisResult {
  const rows = allRows.filter((r) => r.sentiment);
  const byId = new Map(rows.map((r) => [r.source_id, r]));
  const v: VerificationReport = {
    quotes_proposed: 0,
    quotes_verified: 0,
    quotes_rejected: 0,
    ids_rejected: 0,
    themes_dropped: 0,
    recommendations_dropped: 0,
    rows_unanalysed: allRows.length - rows.length,
  };
  const verify = (list: Evidence[]) => {
    const ok: Evidence[] = [];
    for (const ev of list ?? []) {
      v.quotes_proposed++;
      const q = verifyQuote(byId, ev);
      if (q && !ok.some((o) => o.quote === q.quote && o["source_id"] === q.source_id)) {
        v.quotes_verified++;
        ok.push(q);
      } else v.quotes_rejected++;
    }
    return ok;
  };

  const total = rows.length;
  const seenNames = new Set<string>();
  const themes: Theme[] = [];
  for (const t of out.themes ?? []) {
    const name = String(t.name ?? "").trim().slice(0, 80);
    if (!name || seenNames.has(name.toLowerCase())) {
      v.themes_dropped++;
      continue;
    }
    const ids = [...new Set((t.source_ids ?? []).map((s) => String(s).trim()))];
    const valid = ids.filter((id) => byId.has(id));
    v.ids_rejected += ids.length - valid.length;
    const evidence = verify(t.evidence);
    // A theme is shown only if it has real rows AND at least one verified quote.
    if (valid.length === 0 || evidence.length === 0) {
      v.themes_dropped++;
      continue;
    }
    // Evidence rows must belong to the theme.
    evidence.forEach((e) => {
      if (!valid.includes(e.source_id)) valid.push(e.source_id);
    });
    seenNames.add(name.toLowerCase());
    themes.push({
      name,
      description: String(t.description ?? "").trim(),
      source_ids: valid,
      count: valid.length,
      percent: pct(valid.length, total),
      sentiment: sentimentCounts(valid.map((id) => byId.get(id)!)),
      evidence,
    });
  }
  themes.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const themeIds = new Map(themes.map((t) => [t.name.toLowerCase(), t]));
  const order = { high: 0, medium: 1, low: 2 } as const;
  const recommendations: Recommendation[] = [];
  for (const r of out.recommendations ?? []) {
    const linked = [...new Set((r.themes ?? []).map((n) => String(n).trim().toLowerCase()))]
      .map((n) => themeIds.get(n))
      .filter((t): t is Theme => !!t);
    const evidence = verify(r.evidence);
    // Grounded = linked to at least one verified theme and has verified evidence.
    if (linked.length === 0 || evidence.length === 0) {
      v.recommendations_dropped++;
      continue;
    }
    const support = new Set(linked.flatMap((t) => t.source_ids));
    evidence.forEach((e) => support.add(e.source_id));
    recommendations.push({
      title: String(r.title ?? "").trim(),
      rationale: String(r.rationale ?? "").trim(),
      hypothesis: String(r.hypothesis ?? "").trim(),
      priority: order[r.priority] !== undefined ? r.priority : "medium",
      themes: linked.map((t) => t.name),
      evidence,
      supporting_rows: support.size,
    });
  }
  recommendations.sort((a, b) => order[a.priority] - order[b.priority] || b.supporting_rows - a.supporting_rows);

  const counts = sentimentCounts(rows);
  const ratings = rows.map((r) => r.rating).filter((n): n is number => n !== null);
  return {
    total,
    sentiment: { counts, percents: percents<Sentiment>(counts) },
    average_rating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null,
    keywords: keywordStats(rows),
    themes,
    recommendations,
    verification: v,
    summary: String(out.summary ?? "").trim(),
    generated_at: now.toISOString(),
  };
}
