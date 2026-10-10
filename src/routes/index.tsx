import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion, useScroll, useTransform, useMotionValue, useSpring, animate, AnimatePresence } from "framer-motion";
import { ArrowRight, FileSpreadsheet, ScanSearch, ListChecks, ShieldCheck, Quote } from "lucide-react";
import { SiteHeader, Logo } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Revec.ai — Don't just read reviews. Know what to improve." },
      { name: "description", content: "Upload customer reviews or survey responses as CSV or Excel. Get sentiment, themes and improvement recommendations — every claim backed by a verified quote." },
      { property: "og:title", content: "Revec.ai — Don't just read reviews. Know what to improve." },
      { property: "og:description", content: "Evidence-backed customer feedback analysis: calculated statistics and quotes verified against their source rows." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const ease = [0.22, 1, 0.36, 1] as const;

function Landing() {
  const navigate = useNavigate();
  const start = () => navigate({ to: "/analyze" });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main id="main">
        <Hero onStart={start} />
        <Scene />
        <HowItWorks />
        <Trust />
        <LiveProof onStart={start} />
        <FinalCta onStart={start} />
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <Logo />
          <p>Customer feedback, turned into evidence-backed decisions.</p>
        </div>
      </footer>
    </div>
  );
}

function Hero({ onStart }: { onStart: () => void }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const demoY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 60]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 30]);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 });
  const sy = useSpring(my, { stiffness: 60, damping: 18 });
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width - 0.5) * 12);
    my.set(((e.clientY - r.top) / r.height - 0.5) * 10);
  };

  return (
    <section ref={ref} onMouseMove={onMove} onMouseLeave={() => { mx.set(0); my.set(0); }} className="relative overflow-hidden border-b border-border">
      <motion.div aria-hidden className="paper-grid absolute inset-0 opacity-60" style={{ y: textY }} />
      <div className="relative mx-auto grid max-w-6xl gap-14 px-5 pb-20 pt-16 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
        <motion.div style={{ y: textY }}>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            Customer feedback intelligence
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.05, ease }} className="font-display mt-5 text-[3.25rem] sm:text-7xl lg:text-8xl">
            800 responses. Board meeting Friday. <em className="text-primary">Now what?</em>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1, ease }} className="mt-7 max-w-xl text-base sm:text-lg text-muted-foreground">
            Revec.ai reads every review and survey answer for you — then hands you sentiment, recurring themes and prioritised fixes, each one backed by a quote verified word-for-word against the original row.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.18, ease }} className="mt-9 flex flex-wrap items-center gap-4">
            <Button variant="hero" size="xl" onClick={onStart}>
              Start an analysis <ArrowRight />
            </Button>
            <span className="text-sm text-muted-foreground">CSV or XLSX · up to 2,000 responses · no sign-up</span>
          </motion.div>
        </motion.div>
        <motion.div {...(reduce ? {} : { style: { y: demoY, x: sx, rotateZ: sy } })}>
          <LiveDemo />
        </motion.div>
      </div>
    </section>
  );
}

function CountUp({ to, active, delay = 0 }: { to: number; active: boolean; delay?: number }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce || !active) { if (!active && !reduce) setV(0); return; }
    const c = animate(0, to, { duration: 1, delay, ease: "easeOut", onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [to, active, delay, reduce]);
  return <>{v}</>;
}

const demoRows = [
  { id: "R-0012", text: "Delivery was two days late and nobody told me.", s: "negative" },
  { id: "R-0047", text: "Love the product, but the tracking page never updates.", s: "neutral" },
  { id: "R-0103", text: "Third order arrived late again. Considering cancelling.", s: "negative" },
] as const;

const phases = ["Reading responses", "Scoring sentiment", "Verifying quotes", "Writing recommendation"] as const;

function LiveDemo() {
  const reduce = useReducedMotion();
  // phase: 0 rows in · 1 sentiment · 2 highlights+verify · 3 recommendation · then loop
  const [phase, setPhase] = useState(reduce ? 3 : 0);

  useEffect(() => {
    if (reduce) return;
    const timings = [1800, 2200, 2200, 3600];
    let t: ReturnType<typeof setTimeout>;
    const advance = (p: number) => {
      t = setTimeout(() => {
        const next = (p + 1) % 4;
        setPhase(next);
        advance(next);
      }, timings[p]);
    };
    advance(0);
    return () => clearTimeout(t);
  }, [reduce]);

  const dot = { negative: "bg-negative", neutral: "bg-neutral", positive: "bg-positive" } as const;

  return (
    <div className="relative" aria-label="Live illustrative example of a Revec.ai analysis">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Illustrative sample</p>
        <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground" aria-live="polite">
          <motion.span
            className="size-1.5 rounded-full bg-positive"
            {...(reduce ? {} : { animate: { opacity: [1, 0.25, 1] } })}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
          {phases[phase]}…
        </p>
      </div>

      <div className="relative space-y-2.5">
        {demoRows.map((r, i) => (
          <motion.div
            key={r.id}
            initial={reduce ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12, duration: 0.5, ease }}
            className="relative flex items-start gap-3 overflow-hidden rounded-lg border border-border bg-card px-4 py-3 shadow-paper"
          >
            {/* scanning line */}
            {!reduce && phase === 0 && (
              <motion.div
                aria-hidden
                className="absolute inset-y-0 w-10 bg-primary/10"
                initial={{ left: "-10%" }}
                animate={{ left: "110%" }}
                transition={{ delay: 0.3 + i * 0.25, duration: 0.8, ease: "easeInOut" }}
              />
            )}
            <motion.span
              className={`mt-1.5 size-2 shrink-0 rounded-full ${dot[r.s]}`}
              initial={reduce ? false : { scale: 0 }}
              animate={{ scale: phase >= 1 ? 1 : 0.4, opacity: phase >= 1 ? 1 : 0.4 }}
              transition={{ delay: i * 0.15, type: "spring", stiffness: 400, damping: 16 }}
            />
            <p className="flex-1 text-sm">
              {r.text.split(/(late|tracking page never updates)/).map((part, j) =>
                /late|tracking/.test(part) ? (
                  <motion.span
                    key={j}
                    className="mark-evidence"
                    initial={false}
                    animate={{ backgroundSize: phase >= 2 ? "100% 100%" : "0% 100%" }}
                    style={{ backgroundRepeat: "no-repeat" }}
                    transition={{ delay: i * 0.18, duration: 0.45 }}
                  >
                    {part}
                  </motion.span>
                ) : (
                  <span key={j}>{part}</span>
                ),
              )}
            </p>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{r.id}</span>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-border bg-card px-4 py-3 shadow-paper" aria-label="Illustrative sentiment summary">
        <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <span>Sentiment · 3 responses</span>
          <span>counted in code</span>
        </div>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label="67% negative, 33% neutral in this sample">
          <motion.div className="bg-negative" initial={false} animate={{ width: phase >= 1 ? "67%" : "0%" }} transition={{ duration: 0.8, ease }} />
          <motion.div className="bg-neutral" initial={false} animate={{ width: phase >= 1 ? "33%" : "0%" }} transition={{ duration: 0.6, delay: 0.15, ease }} />
        </div>
        <div className="mt-2.5 flex gap-4 font-mono text-[11px] text-muted-foreground">
          <span><span className="text-negative font-medium"><CountUp to={67} active={phase >= 1} />%</span> negative</span>
          <span><span className="font-medium text-foreground"><CountUp to={33} active={phase >= 1} delay={0.15} />%</span> neutral</span>
        </div>
      </div>

      <div className="mt-5 min-h-[148px]">
        <AnimatePresence mode="wait">
          {phase >= 2 && (
            <motion.div
              key="rec"
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              {...(reduce ? {} : { exit: { opacity: 0, y: -12 } })}
              transition={{ duration: 0.5, ease }}
              {...(reduce ? {} : { whileHover: { y: -4 } })}
              className="relative rounded-xl bg-ink p-6 text-ink-foreground shadow-lift"
            >
              <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest opacity-70">
                <span>Recommendation · high priority</span>
                <span>3 verified quotes</span>
              </div>
              <p className="font-display mt-3 text-2xl sm:text-3xl">Send proactive delay alerts and fix live tracking.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {demoRows.map((r, i) => (
                  <motion.span
                    key={r.id}
                    initial={false}
                    animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0.35, scale: 0.92 }}
                    transition={{ delay: i * 0.14, type: "spring", stiffness: 300, damping: 18 }}
                    className="rounded-full border border-ink-foreground/25 px-2.5 py-1 font-mono text-[11px]"
                  >
                    {phase >= 3 ? "✓" : "…"} {r.id}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6, delay, ease }} className={className}>
      {children}
    </motion.div>
  );
}

function Scene() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">A familiar Tuesday</p>
      </Reveal>
      <div className="mt-8 grid gap-10 md:grid-cols-[1.2fr_1fr]">
        <Reveal delay={0.05}>
          <h2 className="font-display text-4xl sm:text-5xl">
            Meet Maya. She runs product at a 40-person company. 800 survey responses just landed — and the board meets Friday.
          </h2>
        </Reveal>
        <Reveal delay={0.12} className="space-y-6 text-lg text-muted-foreground">
          <p>Reading them all takes days she doesn't have. So she does what everyone does: skims the first fifty, and the loudest complaint wins the roadmap.</p>
          <p>Three months later, churn hasn't moved. The fix that would have retained customers was sitting in row 612 — and nobody read that far.</p>
          <p className="border-l-2 border-primary pl-5 font-medium text-foreground">
            Revec.ai exists for that Tuesday. Maya uploads the file, and in minutes she has the themes, the counts, and the exact customer sentences to put on the slide.
          </p>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Maya is an illustrative scenario — not a real customer.</p>
        </Reveal>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: FileSpreadsheet, t: "Upload", d: "Drop in a CSV or Excel file and pick the column that holds the feedback. We validate and clean it first." },
    { icon: ScanSearch, t: "Analyse", d: "Each response gets a sentiment and keywords. Responses are grouped into recurring themes." },
    { icon: ListChecks, t: "Act", d: "Get prioritised recommendations with supporting quotes, then download the report for your team." },
  ];
  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">How it works</p>
          <h2 className="font-display mt-4 max-w-2xl text-4xl sm:text-5xl">From spreadsheet to action plan in three steps.</h2>
        </Reveal>
        <ol className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.li key={s.t} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, delay: i * 0.08, ease }} whileHover={{ y: -6 }} className="group flex h-full flex-col bg-card p-7 transition-shadow hover:shadow-lift sm:p-8">
                <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                <s.icon className="mt-6 size-6 text-primary transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" aria-hidden />
                <h3 className="font-display mt-4 text-3xl">{s.t}</h3>
                <p className="mt-3 text-muted-foreground">{s.d}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Trust() {
  const points = [
    { k: "Counted, not guessed", v: "Every number and percentage is calculated from your uploaded rows, so the totals always add up." },
    { k: "Quotes checked word for word", v: "Each supporting quote must match its source row exactly. Anything that doesn't is removed before you see it." },
    { k: "Traceable to the row", v: "Every quote carries a source ID. Click it to read the full original response." },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <Reveal>
          <ShieldCheck className="size-8 text-primary" aria-hidden />
          <h2 className="font-display mt-5 text-5xl">Why not just paste it into a chatbot?</h2>
          <p className="mt-5 text-lg text-muted-foreground">Because a chatbot's numbers are guesses and its quotes can be invented. Revec.ai lets AI do the reading — then plain code does the counting and checks every quote.</p>
        </Reveal>
        <div className="divide-y divide-border border-y border-border">
          {points.map((p, i) => (
            <Reveal key={p.k} delay={i * 0.08}>
              <motion.div whileHover={{ x: 6 }} transition={{ type: "spring", stiffness: 300, damping: 22 }} className="grid gap-2 py-7 sm:grid-cols-[220px_1fr]">
                <h3 className="font-medium">{p.k}</h3>
                <p className="text-muted-foreground">{p.v}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.15} className="lg:col-span-2">
          <figure className="rounded-xl border border-border bg-card p-7 shadow-paper sm:p-9">
            <Quote className="size-5 text-primary" aria-hidden />
            <blockquote className="font-display mt-4 max-w-3xl text-2xl sm:text-3xl">
              "Third order arrived late again. Considering cancelling."
            </blockquote>
            <figcaption className="mt-4 font-mono text-xs text-muted-foreground">
              Verified against row <span className="text-primary">R-0103</span> · illustrative sample — your report does this with your real data
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}

function LiveProof({ onStart }: { onStart: () => void }) {
  const samples = [
    { label: "Meal-kit delivery", desc: "44 reviews · mostly negative · includes messy rows on purpose" },
    { label: "SaaS product", desc: "30 reviews · mixed sentiment" },
    { label: "Boutique hotel", desc: "30 reviews · mostly positive" },
  ];
  return (
    <section className="border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Live proof, not screenshots</p>
          <h2 className="font-display mt-4 max-w-3xl text-4xl sm:text-5xl">Don't take our word for it. Run the analysis yourself.</h2>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Three fictional datasets, three very different businesses. Pick one, watch it analyse in real time, and compare the reports — every number is computed fresh, every quote checked against its row. Nothing on the results page is hardcoded.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
          {samples.map((s, i) => (
            <motion.button
              key={s.label}
              type="button"
              onClick={onStart}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease }}
              whileHover={{ y: -6 }}
              className="group flex h-full flex-col bg-card p-7 text-left transition-shadow hover:shadow-lift sm:p-8"
            >
              <span className="font-mono text-xs text-muted-foreground">Sample 0{i + 1}</span>
              <h3 className="font-display mt-4 text-3xl">{s.label}</h3>
              <p className="mt-3 flex-1 text-muted-foreground">{s.desc}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary">
                Analyse this dataset <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ onStart }: { onStart: () => void }) {
  return (
    <section className="px-5 pb-24 pt-16 sm:pt-24">
      <Reveal className="mx-auto max-w-6xl rounded-2xl bg-ink px-6 py-14 text-center text-ink-foreground shadow-lift sm:px-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] opacity-60">The vision</p>
        <h2 className="font-display mt-4 text-4xl sm:text-6xl">A world where no customer sentence goes unread.</h2>
        <p className="mx-auto mt-5 max-w-xl opacity-75">
          Every team says customers come first. Revec.ai makes it literal — every review read, every theme counted, every decision traceable to a real person's words.
        </p>
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="mt-9 inline-block">
          <Button variant="signal" size="xl" onClick={onStart}>
            Start an analysis <ArrowRight />
          </Button>
        </motion.div>
      </Reveal>
    </section>
  );
}
