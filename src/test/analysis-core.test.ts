import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  percents,
  verifyQuote,
  prepareRows,
  keywordStats,
  validateBatch,
  buildResult,
  stableId,
  type FeedbackRow,
} from "@/lib/analysis-core";
import { parseFeedbackFile, guessTextColumn, guessIdColumn } from "@/lib/parse-file";

const row = (id: string, text: string, sentiment: FeedbackRow["sentiment"] = "negative"): FeedbackRow => ({
  source_id: id, text, rating: null, category: null, date: null, sentiment, sentiment_score: -1, keywords: ["late"],
});
const fileOf = (path: string, name = path.split("/").pop()!) => new File([readFileSync(path)], name);

describe("analysis core", () => {
  it("percentages always sum to 100", () => {
    const p = percents({ positive: 1, neutral: 1, negative: 1 });
    expect(Math.round((p.positive + p.neutral + p.negative) * 10)).toBe(1000);
    expect(percents({ positive: 0, neutral: 0, negative: 0 }).positive).toBe(0);
  });
  it("accepts only exact quotes from the cited row", () => {
    const m = new Map([["R-0001", row("R-0001", "The box arrived late.")]]);
    expect(verifyQuote(m, { source_id: "R-0001", quote: "arrived late" })).not.toBeNull();
    expect(verifyQuote(m, { source_id: "R-0001", quote: "arrived very late" })).toBeNull();
    expect(verifyQuote(m, { source_id: "R-9999", quote: "arrived late" })).toBeNull();
  });
  it("drops empty, short and duplicate rows; generates stable IDs", () => {
    const r = prepareRows([{ t: "" }, { t: "ok" }, { t: "Good food" }, { t: "good food" }], { text: "t" });
    expect(r.rows).toHaveLength(1);
    expect([r.empty, r.short, r.dupes, r.ids_generated]).toEqual([1, 1, 1, 1]);
    expect(r.rows[0]!.source_id).toBe(stableId("good food"));
  });
  it("counts keywords by row", () => {
    expect(keywordStats([row("a", "late box"), row("b", "late again")])[0]).toMatchObject({ term: "late", count: 2, percent: 100 });
  });
});

describe("invalid model output", () => {
  const rows = [{ source_id: "A", text: "Box was late" }, { source_id: "B", text: "Great food" }];
  it("rejects unknown IDs, duplicates, bad sentiments and non-arrays", () => {
    const { results, rejected } = validateBatch(rows, [
      { source_id: "A", sentiment: "negative", score: -5, keywords: ["late", "invented"] },
      { source_id: "A", sentiment: "positive", score: 1, keywords: [] },
      { source_id: "Z", sentiment: "positive", score: 1, keywords: [] },
      { source_id: "B", sentiment: "ecstatic", score: 1, keywords: [] },
      null,
    ]);
    expect(results).toEqual([{ source_id: "A", sentiment: "negative", sentiment_score: -1, keywords: ["late"] }]);
    expect(rejected).toBe(4);
    expect(validateBatch(rows, "garbage").results).toEqual([]);
  });
});

describe("incorrect source references", () => {
  const rows = [row("A", "The box arrived late again."), row("B", "Delivery was late and cold."), row("C", "Lovely recipes.", "positive"), { ...row("D", "Unclassified"), sentiment: null }];
  const out = buildResult(rows, {
    summary: "s",
    themes: [
      { name: "Late delivery", description: "", source_ids: ["A", "B", "GHOST"], evidence: [{ source_id: "A", quote: "arrived late" }, { source_id: "B", quote: "made up quote" }] },
      { name: "Phantom", description: "", source_ids: ["X"], evidence: [{ source_id: "X", quote: "nothing" }] },
      { name: "No evidence", description: "", source_ids: ["C"], evidence: [{ source_id: "C", quote: "fabricated" }] },
    ],
    recommendations: [
      { title: "Fix couriers", rationale: "", hypothesis: "Courier capacity may be low", priority: "high", themes: ["late delivery"], evidence: [{ source_id: "B", quote: "late and cold" }] },
      { title: "Ungrounded", rationale: "", hypothesis: "", priority: "low", themes: ["Phantom"], evidence: [{ source_id: "C", quote: "Lovely recipes" }] },
      { title: "Bad quote", rationale: "", hypothesis: "", priority: "low", themes: ["Late delivery"], evidence: [{ source_id: "A", quote: "never said" }] },
    ],
  });
  it("drops ghost IDs, fabricated quotes and ungrounded items; counts in code", () => {
    expect(out.total).toBe(3);
    expect(out.verification.rows_unanalysed).toBe(1);
    expect(out.themes.map((t) => t.name)).toEqual(["Late delivery"]);
    expect(out.themes[0]).toMatchObject({ count: 2, percent: 66.7, source_ids: ["A", "B"] });
    expect(out.verification.ids_rejected).toBe(1 + 1);
    expect(out.recommendations.map((r) => r.title)).toEqual(["Fix couriers"]);
    expect(out.recommendations[0]!.hypothesis).toContain("may");
    expect(out.verification.recommendations_dropped).toBe(2);
    expect(out.sentiment.counts).toEqual({ positive: 1, neutral: 0, negative: 2 });
    // Every displayed quote is an exact substring of its cited row.
    const byId = new Map(rows.map((r) => [r.source_id, r.text]));
    [...out.themes.flatMap((t) => t.evidence), ...out.recommendations.flatMap((r) => r.evidence)].forEach((e) =>
      expect(byId.get(e.source_id)).toContain(e.quote),
    );
  });
  it("handles empty model output", () => {
    const r = buildResult(rows, { summary: "", themes: [], recommendations: [] });
    expect(r.themes).toEqual([]);
    expect(r.recommendations).toEqual([]);
  });
});

describe("files", () => {
  it("parses the synthetic Revec.ai dataset with its deliberate problems", async () => {
    const p = await parseFeedbackFile(fileOf("public/revec-synthetic-reviews.csv"));
    expect(guessTextColumn(p)).toBe("review");
    expect(guessIdColumn(p)).toBe("review_id");
    const r = prepareRows(p.rows, { text: "review", id: "review_id", rating: "rating", category: "category", date: "date" });
    expect(r.rows).toHaveLength(42);
    expect([r.empty, r.dupes, r.duplicate_ids, r.bad_ratings, r.ids_generated]).toEqual([1, 1, 1, 1, 2]);
    expect(new Set(r.rows.map((x) => x.source_id)).size).toBe(42);
    expect(r.rows[0]).toMatchObject({ source_id: "RV-1001", category: "Delivery", rating: 1, date: "2026-01-01" });
  });
  it("rejects malformed and unsupported files", async () => {
    await expect(parseFeedbackFile(new File([""], "x.csv"))).rejects.toThrow(/empty/);
    await expect(parseFeedbackFile(new File(["a"], "x.pdf"))).rejects.toThrow(/\.csv or \.xlsx/);
    await expect(parseFeedbackFile(fileOf("src/test/fixtures/broken.xlsx"))).rejects.toThrow();
    await expect(parseFeedbackFile(fileOf("src/test/fixtures/empty-rows.csv"))).rejects.toThrow(/No rows/);
  });
  it("flags a file with no review text column", async () => {
    const p = await parseFeedbackFile(fileOf("src/test/fixtures/no-text.csv"));
    expect(guessTextColumn(p)).toBe("");
  });
});
