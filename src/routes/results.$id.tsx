import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Download, FileText, ShieldCheck, Trash2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { deleteAnalysis, loadAnalysis, type StoredAnalysis } from "@/lib/store";
import { toast } from "sonner";
import { buildMarkdown, download, downloadPdf, preloadPdf } from "@/lib/report";
import type { Evidence, Sentiment } from "@/lib/analysis-core";

export const Route = createFileRoute("/results/$id")({
  head: () => ({
    meta: [
      { title: "Feedback report — Revec.ai" },
      { name: "description", content: "Sentiment, themes and evidence-backed recommendations from your customer feedback." },
      { property: "og:title", content: "Feedback report — Revec.ai" },
      { property: "og:description", content: "An evidence-backed customer feedback report." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResultsPage,
});

const sentColor: Record<Sentiment, string> = { positive: "bg-positive", neutral: "bg-neutral", negative: "bg-negative" };

function ResultsPage() {
  const { id } = Route.useParams();
  const [data, setData] = useState<StoredAnalysis | null | undefined>(undefined);
  const [openId, setOpenId] = useState<string | null>(null);
  const navigate = useNavigate();
  useEffect(() => { void preloadPdf(); }, []);
  useEffect(() => {
    setData(undefined);
    setData(loadAnalysis(id));
  }, [id]);
  const rowsById = useMemo(() => new Map((data?.rows ?? []).map((r) => [r.source_id, r])), [data]);

  if (data === undefined) {
    return <Shell><div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />)}</div></Shell>;
  }
  if (data === null) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <h1 className="font-display text-4xl">Report not found</h1>
          <p className="mt-3 text-muted-foreground">Demo reports are kept in the browser that created them. Run a new analysis to see results here.</p>
          <Button variant="hero" size="xl" className="mt-6" asChild><Link to="/analyze">Start an analysis</Link></Button>
        </div>
      </Shell>
    );
  }
  const r = data.result;
  const openRow = openId ? rowsById.get(openId) : null;

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Step 2 of 2 · Report</p>
          <h1 className="font-display mt-3 text-[2.75rem] sm:text-6xl">What to improve</h1>
          <p className="mt-2 text-sm text-muted-foreground">{data.filename} · {r.total.toLocaleString()} responses analysed{data.excluded ? ` · ${data.excluded} excluded` : ""}{r.verification.rows_unanalysed ? ` · ${r.verification.rows_unanalysed} could not be classified` : ""} · generated {new Date(r.generated_at).toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="hero" size="lg" onClick={() => downloadPdf(data.filename, r).catch(() => toast.error("Couldn't create the PDF. Try the Markdown version."))}><Download /> PDF report</Button>
          <Button variant="quiet" size="lg" onClick={() => download(`revec-report.md`, new Blob([buildMarkdown(data.filename, r)], { type: "text/markdown" }))}><FileText /> Markdown</Button>
          <Button variant="ghost" size="lg" onClick={() => { deleteAnalysis(id); toast.success("Report deleted from this browser."); navigate({ to: "/analyze" }); }}><Trash2 /> Delete</Button>
        </div>
      </div>

      <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mt-8 max-w-3xl border-l-2 border-primary pl-5 text-base leading-relaxed sm:text-lg">{r.summary}</motion.p>

      <section aria-labelledby="sent" className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-[1.4fr_1fr]">
        <div className="bg-card p-6">
          <h2 id="sent" className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Sentiment</h2>
          <div className="mt-5 flex h-4 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Positive ${r.sentiment.percents.positive}%, neutral ${r.sentiment.percents.neutral}%, negative ${r.sentiment.percents.negative}%`}>
            {(["positive", "neutral", "negative"] as const).map((s) => (
              <motion.div key={s} className={sentColor[s]} initial={{ width: 0 }} animate={{ width: `${r.sentiment.percents[s]}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
            ))}
          </div>
          <table className="sr-only"><caption>Sentiment breakdown</caption><thead><tr><th>Sentiment</th><th>Responses</th><th>Share</th></tr></thead><tbody>{(["positive", "neutral", "negative"] as const).map((s) => <tr key={s}><td>{s}</td><td>{r.sentiment.counts[s]}</td><td>{r.sentiment.percents[s]}%</td></tr>)}</tbody></table>
          <dl className="mt-5 grid grid-cols-3 gap-4" aria-hidden>
            {(["positive", "neutral", "negative"] as const).map((s) => (
              <div key={s}>
                <dt className="flex items-center gap-2 text-xs capitalize text-muted-foreground"><span className={`size-2 rounded-full ${sentColor[s]}`} />{s}</dt>
                <dd className="font-display mt-1 text-3xl tabular-nums sm:text-4xl">{r.sentiment.percents[s]}%</dd>
                <dd className="text-xs text-muted-foreground">{r.sentiment.counts[s]} responses</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="bg-ink p-6 text-ink-foreground">
          <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest opacity-70"><ShieldCheck className="size-4" /> Verification</h2>
          <p className="font-display mt-4 text-5xl">{r.verification.quotes_verified}/{r.verification.quotes_proposed}</p>
          <p className="mt-2 text-sm opacity-80">quotes matched their source row exactly. {r.verification.quotes_rejected} removed{r.verification.themes_dropped ? `, ${r.verification.themes_dropped} unsupported theme(s) dropped` : ""}{r.verification.recommendations_dropped ? `, ${r.verification.recommendations_dropped} unsupported recommendation(s) dropped` : ""}. All numbers are calculated from your rows.</p>
          {r.average_rating !== null && <p className="mt-4 font-mono text-sm">Average rating ★ {r.average_rating}</p>}
        </div>
      </section>

      <section aria-labelledby="recs" className="mt-16">
        <h2 id="recs" className="font-display text-3xl sm:text-4xl">Recommendations</h2>
        {r.recommendations.length === 0 && <p className="mt-4 text-muted-foreground">No recommendation had verified evidence, so none are shown.</p>}
        <ol className="mt-6 space-y-4">
          {r.recommendations.map((rec, i) => (
            <motion.li key={i} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="rounded-xl border border-border bg-card p-5 shadow-paper sm:p-6">
              <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-widest">
                <span className={rec.priority === "high" ? "text-primary" : "text-muted-foreground"}>{rec.priority} priority</span>
                <span className="text-muted-foreground">· {rec.supporting_rows} supporting responses</span>
              </div>
              <h3 className="font-display mt-2 text-2xl sm:text-3xl">{i + 1}. {rec.title}</h3>
              <p className="mt-2 text-muted-foreground"><span className="font-mono text-[11px] uppercase tracking-widest text-foreground">Observed · </span>{rec.rationale}</p>
              {rec.hypothesis && <p className="mt-2 text-sm text-muted-foreground"><span className="font-mono text-[11px] uppercase tracking-widest text-primary">Hypothesis · unverified · </span>{rec.hypothesis}</p>}
              {rec.themes.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Addresses: {rec.themes.join(", ")}</p>}
              <EvidenceList items={rec.evidence} onOpen={setOpenId} />
            </motion.li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="themes" className="mt-16">
        <h2 id="themes" className="font-display text-3xl sm:text-4xl">Themes, ranked</h2>
        <p className="mt-2 text-sm text-muted-foreground">Share of analysed responses assigned to each theme. A response can belong to several themes.</p>
        {r.themes.length === 0 && <p className="mt-4 text-muted-foreground">No themes could be verified.</p>}
        <ol className="mt-6 divide-y divide-border border-y border-border">
          {r.themes.map((t, ti) => (
            <li key={t.name} className="grid gap-4 py-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-10">
              <div className="min-w-0">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{String(ti + 1).padStart(2, "0")}</span>
                  <h3 className="min-w-0 text-lg font-semibold leading-snug">{t.name}</h3>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden><div className="h-full rounded-full bg-primary" style={{ width: `${t.percent}%` }} /></div>
                  <span className="font-mono text-sm tabular-nums">{t.percent}%</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{t.count} responses · {t.sentiment.negative} negative · {t.sentiment.neutral} neutral · {t.sentiment.positive} positive</p>
                {t.description && <p className="mt-3 text-sm text-muted-foreground">{t.description}</p>}
              </div>
              <div className="min-w-0"><EvidenceList items={t.evidence} onOpen={setOpenId} /></div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="kw" className="mt-16">
        <h2 id="kw" className="font-display text-3xl sm:text-4xl">Top keywords</h2>
        <p className="mt-2 text-sm text-muted-foreground">Share of responses that mention each term.</p>
        <ul className="mt-6 grid gap-x-10 gap-y-3 sm:grid-cols-2">
          {r.keywords.map((k) => (
            <li key={k.term} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
              <span>{k.term}</span>
              <span className="font-mono text-xs text-muted-foreground">{k.count} · {k.percent}%</span>
              <div className="col-span-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-foreground/70" style={{ width: `${Math.min(100, k.percent * 2)}%` }} /></div>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-16 border-t border-border pt-8">
        <Button variant="quiet" asChild><Link to="/analyze">Analyse another file</Link></Button>
      </div>

      <Sheet open={!!openRow} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="bg-card">
          {openRow && (
            <SheetHeader>
              <SheetTitle className="font-mono">{openRow.source_id}</SheetTitle>
              <SheetDescription>Original response from your file</SheetDescription>
              <p className="mt-4 text-base leading-relaxed text-foreground">{openRow.text}</p>
              <div className="mt-6 flex flex-wrap gap-2 text-xs">
                {openRow.sentiment && <span className="rounded-full border border-border px-2.5 py-1 capitalize">{openRow.sentiment}</span>}
                {openRow.category && <span className="rounded-full border border-border px-2.5 py-1">{openRow.category}</span>}
                {openRow.date && <span className="rounded-full border border-border px-2.5 py-1 font-mono">{openRow.date}</span>}
                {openRow.rating !== null && <span className="rounded-full border border-border px-2.5 py-1">★ {openRow.rating}</span>}
                {openRow.keywords.map((k) => <span key={k} className="rounded-full bg-muted px-2.5 py-1">{k}</span>)}
              </div>
            </SheetHeader>
          )}
        </SheetContent>
      </Sheet>
    </Shell>
  );
}

function EvidenceList({ items, onOpen }: { items: Evidence[]; onOpen: (id: string) => void }) {
  return (
    <ul className="mt-4 space-y-2">
      {items.map((e) => (
        <li key={e.source_id + e.quote}>
          <button type="button" onClick={() => onOpen(e.source_id)} aria-label={`Open source response ${e.source_id}`} className="group flex w-full items-start gap-3 rounded-r-md border-l-2 border-primary bg-background px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent active:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="min-w-0 flex-1 italic leading-relaxed">“{e.quote}”</span>
            <span className="shrink-0 pt-0.5 font-mono text-[11px] text-muted-foreground group-hover:text-primary">✓ {e.source_id}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-5xl px-5 py-10 sm:py-14">{children}</main>
    </div>
  );
}
