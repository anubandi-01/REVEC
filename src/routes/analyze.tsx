import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { Check, FileUp, Loader2, AlertTriangle, RotateCcw } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { UploadAbout } from "@/components/UploadAbout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { parseFeedbackFile, guessRatingColumn, guessTextColumn, guessIdColumn, guessCategoryColumn, guessDateColumn, type ParsedFile } from "@/lib/parse-file";
import { prepareRows, MAX_ROWS, type FeedbackRow } from "@/lib/analysis-core";
import { analyzeBatch, synthesize, BATCH_SIZE } from "@/lib/datasets.functions";
import { saveAnalysis } from "@/lib/store";

export const Route = createFileRoute("/analyze")({
  head: () => ({
    meta: [
      { title: "Upload feedback — Revec.ai" },
      { name: "description", content: "Upload a CSV or Excel file of reviews or survey responses to analyse sentiment, themes and improvements." },
      { property: "og:title", content: "Upload feedback — Revec.ai" },
      { property: "og:description", content: "Validate and analyse your customer feedback file in minutes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyzePage,
});

type Stage = "idle" | "parsed" | "running" | "error";
const STEPS = ["Validating rows", "Scoring sentiment & keywords", "Finding themes & recommendations", "Verifying every quote"];

const samples = [
  { path: "/revec-synthetic-reviews.csv", filename: "revec-synthetic-reviews.csv", label: "Meal-kit delivery", desc: "44 reviews · mostly negative" },
  { path: "/sample-saas-reviews.csv", filename: "sample-saas-reviews.csv", label: "SaaS product", desc: "30 reviews · mixed" },
  { path: "/sample-hotel-reviews.csv", filename: "sample-hotel-reviews.csv", label: "Boutique hotel", desc: "30 reviews · mostly positive" },
];

function AnalyzePage() {
  const navigate = useNavigate();
  const runBatch = useServerFn(analyzeBatch);
  const runSynth = useServerFn(synthesize);
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [textCol, setTextCol] = useState("");
  const [ratingCol, setRatingCol] = useState<string>("");
  const [idCol, setIdCol] = useState("");
  const [catCol, setCatCol] = useState("");
  const [dateCol, setDateCol] = useState("");
  const running = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [batchInfo, setBatchInfo] = useState("");

  const prepared = useMemo(
    () => (file && textCol ? prepareRows(file.rows, { text: textCol, rating: ratingCol || null, id: idCol || null, category: catCol || null, date: dateCol || null }) : null),
    [file, textCol, ratingCol, idCol, catCol, dateCol],
  );

  async function handleFile(f: File) {
    setError(null);
    setLoading(true);
    try {
      const p = await parseFeedbackFile(f);
      setFile(p);
      setTextCol(guessTextColumn(p));
      setRatingCol(guessRatingColumn(p) ?? "");
      setIdCol(guessIdColumn(p) ?? "");
      setCatCol(guessCategoryColumn(p) ?? "");
      setDateCol(guessDateColumn(p) ?? "");
      setStage("parsed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this file.");
      setStage("error");
    } finally {
      setLoading(false);
    }
  }

  async function loadSample(sample: (typeof samples)[number]) {
    if (loading) return;
    setLoading(true);
    let blob: Blob;
    try {
      const res = await fetch(sample.path);
      if (!res.ok) throw new Error();
      blob = await res.blob();
    } catch {
      setLoading(false);
      setError("Couldn't load the sample dataset. Check your connection and try again.");
      setStage("error");
      return;
    }
    handleFile(new File([blob], sample.filename, { type: "text/csv" }));
  }

  async function run() {
    if (!file || !prepared || prepared.rows.length === 0 || running.current) return;
    running.current = true;
    setStage("running");
    setError(null);
    setStep(0);
    setProgress(5);
    // Fresh copies each run so a retry never reuses results from a previous attempt.
    const rows: FeedbackRow[] = prepared.rows.map((r) => ({ ...r, sentiment: null, sentiment_score: null, keywords: [] }));
    const byId = new Map(rows.map((r) => [r.source_id, r]));
    try {
      setStep(1);
      const batches = Math.ceil(rows.length / BATCH_SIZE);
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        setBatchInfo(`Batch ${i / BATCH_SIZE + 1} of ${batches} · ${Math.min(i + BATCH_SIZE, rows.length)} of ${rows.length} responses`);
        let pending = rows.slice(i, i + BATCH_SIZE);
        // One retry for rows the AI skipped or answered invalidly.
        for (let attempt = 0; attempt < 2 && pending.length; attempt++) {
          const res = await runBatch({ data: { rows: pending.map((r) => ({ source_id: r.source_id, text: r.text })) } });
          if (res.error) {
            if (attempt === 1) throw new Error(res.error);
            continue;
          }
          res.results.forEach((x) => Object.assign(byId.get(x.source_id)!, x));
          pending = pending.filter((r) => !r.sentiment);
        }
        setProgress(5 + Math.round((Math.min(i + BATCH_SIZE, rows.length) / rows.length) * 60));
      }
      if (!rows.some((r) => r.sentiment)) throw new Error("The AI could not classify any rows. Please retry.");
      setStep(2);
      setBatchInfo("");
      setProgress(72);
      const synth = await runSynth({ data: { rows } });
      if (synth.error || !synth.result) throw new Error(synth.error ?? "Analysis failed.");
      setStep(4);
      setProgress(100);
      const id = crypto.randomUUID();
      saveAnalysis({
        id,
        filename: file.filename,
        created_at: new Date().toISOString(),
        excluded: prepared.empty + prepared.short + prepared.dupes + prepared.overflow,
        rows,
        result: synth.result,
      });
      setTimeout(() => navigate({ to: "/results/$id", params: { id }, replace: true }), 400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed. Please try again.");
      setStage("error");
      running.current = false;
    }
  }

  function reset() {
    setStage("idle");
    setFile(null);
    setError(null);
    setProgress(0);
  }

  return (
    <div className="min-h-screen">
      <SiteHeader showStart={false} />
      <main id="main" className="mx-auto max-w-4xl px-5 py-10 sm:py-14">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">{stage === "running" ? "Step 1 of 2 · Processing" : "Step 1 of 2 · Upload"}</p>
        <h1 className="font-display mt-3 text-[2.75rem] sm:text-6xl">Bring your feedback.</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          CSV or Excel, with a header row. Up to {MAX_ROWS.toLocaleString()} responses and 10 MB. This demo keeps your results in this browser only.
        </p>

        <AnimatePresence mode="wait">
          {(stage === "idle" || (stage === "error" && !file)) && (
            <motion.div key="drop" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-10">
              <button
                type="button"
                onClick={() => !loading && inputRef.current?.click()}
                aria-busy={loading}
                aria-describedby="drop-help"
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                className={`group flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-[border-color,background-color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.995] sm:py-20 ${drag ? "scale-[1.01] border-primary bg-accent" : "border-border bg-card hover:border-foreground/40 hover:bg-background"}`}
              >
                {loading ? <Loader2 className="size-8 animate-spin text-primary" aria-hidden /> : <FileUp className={`size-8 text-primary transition-transform duration-200 ${drag ? "-translate-y-1" : "group-hover:-translate-y-0.5"}`} aria-hidden />}
                <span className="font-display mt-4 text-3xl">{loading ? "Reading your file…" : drag ? "Release to upload" : "Drop your file here"}</span>
                <span id="drop-help" className="mt-2 text-sm text-muted-foreground">or click to choose · .csv or .xlsx · up to 10 MB</span>
              </button>
              <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="sr-only" aria-label="Upload feedback file" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
              {error && <ErrorBox message={error} />}
              <div className="mt-6">
                <p className="text-sm text-muted-foreground">No file handy? Try a fictional sample dataset:</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {samples.map((s) => (
                    <button
                      key={s.path}
                      type="button"
                      onClick={() => loadSample(s)}
                      disabled={loading}
                      className="rounded-lg border border-border bg-card px-4 py-3 text-left transition-[border-color,box-shadow,transform] hover:border-foreground/40 hover:shadow-paper active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
                    >
                      <span className="block text-sm font-medium">{s.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {file && (stage === "parsed" || (stage === "error" && file)) && (
            <motion.div key="map" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-10 space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4">
                <div>
                  <p className="font-medium">{file.filename}</p>
                  <p className="text-sm text-muted-foreground">{file.rows.length.toLocaleString()} rows · {file.columns.length} columns</p>
                </div>
                <Button variant="ghost" size="sm" onClick={reset}><RotateCcw /> Choose another file</Button>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <ColumnSelect id="text-col" label="Review text column (required)" value={textCol} onChange={setTextCol} columns={file.columns} placeholder="Choose the review text column" />
                <ColumnSelect id="id-col" label="Review ID (optional — generated if missing)" value={idCol} onChange={setIdCol} columns={file.columns} allowNone />
                <ColumnSelect id="rating-col" label="Rating (optional)" value={ratingCol} onChange={setRatingCol} columns={file.columns} allowNone />
                <ColumnSelect id="cat-col" label="Category (optional)" value={catCol} onChange={setCatCol} columns={file.columns} allowNone />
                <ColumnSelect id="date-col" label="Date (optional)" value={dateCol} onChange={setDateCol} columns={file.columns} allowNone />
              </div>

              {!prepared && <ErrorBox message="We couldn't find a column with review text. Choose the column that contains the written feedback." />}
              {prepared && (<>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
                <Stat label="Ready to analyse" value={prepared.rows.length} strong />
                <Stat label="Empty or too short" value={prepared.empty + prepared.short} />
                <Stat label="Duplicates" value={prepared.dupes} />
                <Stat label="Over limit" value={prepared.overflow} />
              </div>
              {(prepared.ids_generated > 0 || prepared.duplicate_ids > 0 || prepared.bad_ratings > 0) && (
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {prepared.ids_generated > 0 && <li>{prepared.ids_generated.toLocaleString()} rows had no usable ID — stable IDs were generated from their text.</li>}
                  {prepared.duplicate_ids > 0 && <li>{prepared.duplicate_ids.toLocaleString()} repeated IDs were replaced with generated ones.</li>}
                  {prepared.bad_ratings > 0 && <li>{prepared.bad_ratings.toLocaleString()} ratings weren't numbers and were ignored.</li>}
                </ul>
              )}

              <div className="overflow-hidden rounded-xl border border-border">
                <p className="border-b border-border bg-muted px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Preview</p>
                <ul className="divide-y divide-border bg-card">
                  {prepared.rows.slice(0, 5).map((r) => (
                    <li key={r.source_id} className="flex gap-4 px-4 py-3 text-sm">
                      <span className="w-20 shrink-0 truncate font-mono text-[11px] text-muted-foreground">{r.source_id}</span>
                      <span className="line-clamp-2 flex-1">{r.text}</span>
                      {r.category && <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[11px] sm:inline">{r.category}</span>}
                      {r.rating !== null && <span className="font-mono text-xs">★ {r.rating}</span>}
                    </li>
                  ))}
                  {prepared.rows.length === 0 && <li className="px-4 py-6 text-sm text-muted-foreground">No usable text in this column. Pick a different column.</li>}
                </ul>
              </div>

              </>)}
              {error && <ErrorBox message={error} />}
              <p className="text-xs text-muted-foreground">
                Privacy: selected feedback and optional fields are sent through our server to a third-party AI service. Your spreadsheet is parsed locally; completed reports and source responses are saved in this browser. Remove personal or sensitive details first. Provider retention has not been verified. Read the data privacy section below before analysing.
              </p>
              <Button variant="hero" size="xl" disabled={!prepared || prepared.rows.length === 0} onClick={run}>
                {error ? <><RotateCcw /> Retry analysis</> : <>Analyse {(prepared?.rows.length ?? 0).toLocaleString()} responses</>}
              </Button>
            </motion.div>
          )}

          {stage === "running" && (
            <motion.div key="run" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-10 rounded-2xl border border-border bg-card p-8 shadow-paper" aria-live="polite">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-display text-3xl">{step === 4 ? "Done." : "Analysing…"}</h2>
                <span className="font-mono text-sm tabular-nums">{progress}%</span>
              </div>
              <Progress value={progress} aria-label="Analysis progress" className="mt-4 [&>div]:transition-transform [&>div]:duration-500" />
              <ol className="mt-8 space-y-4">
                {STEPS.map((s, i) => (
                  <li key={s} className="flex items-center gap-3" aria-current={i === step ? "step" : undefined}>
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${i < step ? "border-positive bg-positive text-ink-foreground" : i === step ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                      {i < step ? <Check className="size-4" /> : i === step ? <Loader2 className="size-4 animate-spin" /> : <span className="font-mono text-xs">{i + 1}</span>}
                    </span>
                    <span className={i <= step ? "text-foreground" : "text-muted-foreground"}>{s}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 h-5 font-mono text-xs text-muted-foreground">{step === 4 ? "Report ready — opening…" : batchInfo}</p>
              <p className="mt-6 text-sm text-muted-foreground">Larger files take a few minutes. Please keep this tab open.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      {stage !== "running" && <UploadAbout />}
    </div>
  );
}

function ColumnSelect({ id, label, value, onChange, columns, allowNone, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; columns: string[]; allowNone?: boolean; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {allowNone && <option value="">None</option>}
        {placeholder && !value && <option value="" disabled>{placeholder}</option>}
        {columns.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="bg-card px-4 py-4">
      <p className={`font-display text-4xl tabular-nums ${strong ? "text-primary" : ""}`}>{value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <p>{message}</p>
    </div>
  );
}
