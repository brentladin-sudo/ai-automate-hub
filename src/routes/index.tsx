import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Clock,
  History,
  Info,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wrench,
  Zap,
} from "lucide-react";
import { runDiagnostic, type DiagnosticResult, type Workflow } from "@/lib/diagnostic.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Go Automate — AI Automation Diagnostic" },
      {
        name: "description",
        content:
          "See where AI can transform your business in sixty seconds. Go Automate scores your company's automation potential and maps the workflows to fix first.",
      },
      { property: "og:title", content: "Go Automate — AI Automation Diagnostic" },
      {
        property: "og:description",
        content:
          "See where AI can transform your business in sixty seconds. Score your company's automation potential.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type HistoryEntry = {
  id: string;
  createdAt: number;
  result: DiagnosticResult;
};

const STORAGE_KEY = "go-automate:history";

function loadHistory(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function timeAgo(ts: number) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ScoreRail({
  score,
  size = "lg",
  delay = 0,
}: {
  score: number;
  size?: "lg" | "sm";
  delay?: number;
}) {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    setSettled(false);
    const t = window.setTimeout(() => setSettled(true), 150 + delay);
    return () => window.clearTimeout(t);
  }, [delay, score]);

  const trackH = size === "lg" ? "h-2" : "h-1.5";
  const dotSize = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";

  return (
    <div>
      <div className="flex items-end justify-between text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        <span>Manual</span>
        <span>Highly Automatable</span>
      </div>
      <div className={`relative mt-2 ${size === "lg" ? "h-5" : "h-3.5"}`}>
        <div
          className={`absolute top-1/2 w-full -translate-y-1/2 rounded-full ${trackH} bg-secondary shadow-[inset_0_1px_2px_oklch(0_0_0/50%)]`}
        />
        <div
          className={`absolute top-1/2 w-full -translate-y-1/2 rounded-full ${trackH} overflow-hidden`}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ width: settled ? `${score}%` : "0%" }}
          />
        </div>
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full ${dotSize} bg-primary shadow-[var(--shadow-glow)] ring-4 ring-primary/20 transition-[left] duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)]`}
          style={{ left: settled ? `${score}%` : "0%" }}
        />
      </div>
    </div>
  );
}

const LEVELS = [
  { value: 1 as const, label: "1 · Simple", hint: "Off-the-shelf, days to ship" },
  { value: 2 as const, label: "2 · Integrated", hint: "Configured and connected, weeks" },
  { value: 3 as const, label: "3 · Custom", hint: "Engineered and bespoke, months" },
];

function tierFor(wf: Workflow, level: 1 | 2 | 3) {
  if (wf.stack) {
    return level === 1 ? wf.stack.level1 : level === 2 ? wf.stack.level2 : wf.stack.level3;
  }
  return { approach: wf.aiApproach, tools: wf.tools ?? [] };
}

function ExpandToggle({
  open,
  onClick,
  label,
}: {
  open: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:border-primary/40 hover:text-foreground"
    >
      {open ? "Less" : label}
      <ChevronDown
        className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
      />
    </button>
  );
}

function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  return (
    <div
      className="grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
    >
      <div className="overflow-hidden">{mounted ? children : null}</div>
    </div>
  );
}

function Index() {
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [level, setLevel] = useState<1 | 2 | 3>(2);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [openWorkflows, setOpenWorkflows] = useState<Record<string, boolean>>({});

  const toggleWorkflow = (name: string) =>
    setOpenWorkflows((prev) => ({ ...prev, [name]: !prev[name] }));


  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const persist = (next: HistoryEntry[]) => {
    setHistory(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await runDiagnostic({
        data: {
          companyName: companyName.trim(),
          description: description.trim() || undefined,
        },
      });
      const entry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        result: res,
      };
      persist([entry, ...history].slice(0, 40));
      setActiveId(entry.id);
      setResult(res);
      setLevel(2);
      setScoreOpen(false);
      setOpenWorkflows({});
    } catch (err) {
      console.error("Diagnostic request failed:", err);
      const message = err instanceof Error && err.message ? err.message : "The diagnostic couldn't complete. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const startNew = () => {
    setResult(null);
    setActiveId(null);
    setCompanyName("");
    setDescription("");
    setError(null);
  };

  const openEntry = (entry: HistoryEntry) => {
    setResult(entry.result);
    setActiveId(entry.id);
    setLevel(2);
    setScoreOpen(false);
    setOpenWorkflows({});
    setError(null);
  };

  const removeEntry = (id: string) => {
    persist(history.filter((h) => h.id !== id));
    if (activeId === id) startNew();
  };

  const filtered = history.filter((h) =>
    h.result.companyName.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(70%_50%_at_50%_-10%,oklch(0.72_0.19_235/12%),transparent_70%)]" />

      <div className="relative flex min-h-screen">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-border bg-card/40 backdrop-blur-sm lg:flex">
          <div className="p-5">
            <div className="flex items-center gap-2 font-display text-base font-bold tracking-tight">
              <Sparkles className="h-4 w-4 text-primary" />
              Go Automate
            </div>

            <button
              onClick={startNew}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
            >
              <Plus className="h-4 w-4" />
              New projection
            </button>

            <div className="relative mt-3">
              <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search companies"
                className="w-full rounded-xl border border-input bg-background py-2.5 pr-3 pl-9 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring/30 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-2 flex min-h-0 flex-1 flex-col border-t border-border px-5 pt-4 pb-5">
            <p className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
              <History className="h-3.5 w-3.5" />
              History
            </p>
            <div className="mt-3 -mr-2 flex-1 space-y-1 overflow-y-auto pr-2">
              {filtered.length === 0 && (
                <p className="text-xs leading-relaxed text-muted-foreground/70">
                  {history.length === 0
                    ? "Your past diagnostics will appear here."
                    : "No matches for that search."}
                </p>
              )}
              {filtered.map((h) => (
                <div
                  key={h.id}
                  className={`group flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                    activeId === h.id ? "bg-secondary" : "hover:bg-secondary/60"
                  }`}
                >
                  <button
                    onClick={() => openEntry(h)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-medium">
                      {h.result.companyName}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {h.result.overallScore}/100 · {timeAgo(h.createdAt)}
                    </span>
                  </button>
                  <button
                    onClick={() => removeEntry(h.id)}
                    aria-label={`Delete ${h.result.companyName}`}
                    className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-3xl px-6 pb-24">
            {!result && (
              <div className="flex min-h-screen flex-col items-center justify-center text-center">
                <div className="animate-rise inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  AI Automation Diagnostic
                </div>
                <h1
                  className="animate-rise mt-6 font-display text-5xl font-bold tracking-tight sm:text-7xl"
                  style={{ animationDelay: "80ms" }}
                >
                  Go Automate
                </h1>
                <p
                  className="animate-rise mt-5 max-w-xl text-lg text-muted-foreground sm:text-xl"
                  style={{ animationDelay: "160ms" }}
                >
                  See where AI can transform your business in sixty seconds.
                </p>

                <form
                  onSubmit={submit}
                  className="animate-rise mt-10 w-full max-w-xl rounded-2xl border border-border bg-card p-6 text-left shadow-[var(--shadow-card)] sm:p-8"
                  style={{ animationDelay: "240ms" }}
                >
                  <label
                    htmlFor="company"
                    className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                  >
                    Company name
                  </label>
                  <input
                    id="company"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Logistics"
                    required
                    className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring/40 focus:outline-none"
                  />
                  <label
                    htmlFor="desc"
                    className="mt-5 block text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                  >
                    Company description{" "}
                    <span className="font-normal normal-case text-muted-foreground/70">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    id="desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does the company do? How many people? What's slowing teams down?"
                    rows={4}
                    className="mt-2 w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring/40 focus:outline-none"
                  />
                  {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
                  <button
                    type="submit"
                    disabled={loading || !companyName.trim()}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Running diagnostic…
                      </>
                    ) : (
                      <>
                        Run Diagnostic
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {result && (
              <div className="pt-16 sm:pt-24">
                <div className="animate-rise flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-widest text-primary uppercase">
                      Diagnostic Report
                    </p>
                    <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                      {result.companyName}
                    </h2>
                  </div>
                  <button
                    onClick={startNew}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New projection
                  </button>
                </div>

                <section
                  className="animate-rise mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8"
                  style={{ animationDelay: "120ms" }}
                >
                  <ScoreRail score={result.overallScore} size="lg" />
                  <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-3">
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <span className="font-display text-5xl font-bold tracking-tight text-primary">
                        {result.overallScore}
                        <span className="text-2xl text-muted-foreground">/100</span>
                      </span>
                      <span className="text-base font-semibold">{result.scoreLabel}</span>
                    </div>
                    {result.dimensions && result.dimensions.length > 0 && (
                      <ExpandToggle
                        open={scoreOpen}
                        onClick={() => setScoreOpen((v) => !v)}
                        label="Breakdown"
                      />
                    )}
                  </div>

                  {result.dimensions && result.dimensions.length > 0 && (
                    <Collapse open={scoreOpen}>
                      <div className="mt-7 border-t border-border pt-6">
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          The overall score is a weighted composite of these four
                          sub-dimensions.
                        </p>
                        <div className="mt-5 space-y-6">
                          {result.dimensions.map((d, di) => (
                            <div key={d.name}>
                              <div className="flex items-baseline justify-between gap-3">
                                <span className="text-sm font-semibold">{d.name}</span>
                                <span className="font-display text-sm font-bold text-primary">
                                  {d.score}/100
                                </span>
                              </div>
                              <div className="mt-2">
                                <ScoreRail
                                  key={scoreOpen ? "open" : "closed"}
                                  score={d.score}
                                  size="sm"
                                  delay={di * 90}
                                />
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                {d.explanation}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Collapse>
                  )}
                </section>

                <section
                  className="animate-rise mt-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8"
                  style={{ animationDelay: "220ms" }}
                >
                  <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                    Company Snapshot
                  </h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">
                    {result.summary}
                  </p>
                </section>

                <h3
                  className="animate-rise mt-12 font-display text-xl font-bold tracking-tight"
                  style={{ animationDelay: "300ms" }}
                >
                  Automation Opportunities
                </h3>
                <div className="mt-5 space-y-4">
                  {result.workflows.map((wf, i) => (
                    <article
                      key={wf.name}
                      className="animate-rise rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
                      style={{ animationDelay: `${360 + i * 90}ms` }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h4 className="font-display text-lg font-semibold">{wf.name}</h4>
                        <span className="rounded-full bg-primary/10 px-3 py-1 font-display text-sm font-bold text-primary">
                          {wf.score}/100
                        </span>
                      </div>
                      <div className="mt-4">
                        <ScoreRail score={wf.score} size="sm" delay={300 + i * 90} />
                      </div>
                      <dl className="mt-5 space-y-3 text-sm leading-relaxed">
                        <div>
                          <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            Today
                          </dt>
                          <dd className="mt-1 text-muted-foreground">{wf.manualToday}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold tracking-wide text-primary uppercase">
                            With AI
                          </dt>
                          <dd className="mt-1 text-foreground/90">{wf.aiApproach}</dd>
                        </div>
                      </dl>

                      {(wf.timeCost || wf.readinessTier || wf.toolRationale) && (
                        <>
                          <div className="mt-5">
                            <ExpandToggle
                              open={!!openWorkflows[wf.name]}
                              onClick={() => toggleWorkflow(wf.name)}
                              label="Go deeper"
                            />
                          </div>
                          <Collapse open={!!openWorkflows[wf.name]}>
                            <div className="mt-5 space-y-4 border-t border-border pt-5 text-sm leading-relaxed">
                              {wf.timeCost && (
                                <div className="flex items-start gap-3">
                                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                  <div>
                                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                      Time &amp; cost today
                                    </p>
                                    <p className="mt-1 text-foreground/90">{wf.timeCost}</p>
                                  </div>
                                </div>
                              )}
                              {wf.readinessTier && (
                                <div className="flex items-start gap-3">
                                  <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                  <div>
                                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                      Readiness tier
                                    </p>
                                    <p className="mt-1.5">
                                      <span
                                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                          wf.readinessTier === "Quick Win"
                                            ? "bg-primary/15 text-primary"
                                            : "bg-secondary text-secondary-foreground"
                                        }`}
                                      >
                                        {wf.readinessTier}
                                      </span>
                                      <span className="ml-2 text-xs text-muted-foreground">
                                        {wf.readinessTier === "Quick Win"
                                          ? "Deployable in weeks"
                                          : "Requires data infrastructure first"}
                                      </span>
                                    </p>
                                  </div>
                                </div>
                              )}
                              {wf.toolRationale && (
                                <div className="flex items-start gap-3">
                                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                  <div>
                                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                      Why this tool
                                    </p>
                                    <p className="mt-1 text-muted-foreground">
                                      {wf.toolRationale}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </Collapse>
                        </>
                      )}
                    </article>
                  ))}
                </div>

                <div
                  className="animate-rise mt-12 flex flex-wrap items-end justify-between gap-4"
                  style={{ animationDelay: `${400 + result.workflows.length * 90}ms` }}
                >
                  <div>
                    <h3 className="font-display text-xl font-bold tracking-tight">
                      Recommended Stack
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      How complicated do you want it?
                    </p>
                  </div>
                  <div className="inline-flex rounded-xl border border-border bg-card p-1">
                    {LEVELS.map((l) => (
                      <button
                        key={l.value}
                        onClick={() => setLevel(l.value)}
                        title={l.hint}
                        className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                          level === l.value
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
                <p
                  className="animate-rise mt-3 text-xs text-muted-foreground"
                  style={{ animationDelay: `${430 + result.workflows.length * 90}ms` }}
                >
                  {LEVELS.find((l) => l.value === level)?.hint}
                </p>

                <div
                  className="animate-rise mt-5 space-y-3"
                  style={{ animationDelay: `${460 + result.workflows.length * 90}ms` }}
                >
                  {result.workflows.map((wf) => {
                    const tier = tierFor(wf, level);
                    return (
                      <div
                        key={wf.name}
                        className="rounded-xl border border-border bg-card px-5 py-4"
                      >
                        <span className="text-sm font-semibold">{wf.name}</span>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {tier.approach}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {tier.tools.map((tool) => (
                            <span
                              key={tool}
                              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                            >
                              <Wrench className="h-3 w-3 text-primary" />
                              {tool}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <section className="mt-14 border-t border-dashed border-border pt-8">
                  <h3 className="font-display text-lg font-semibold tracking-tight text-muted-foreground">
                    What This Diagnostic Cannot Tell You
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Caveats, not findings — these need a conversation inside the business.
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {(result.limitations ?? FALLBACK_LIMITATIONS).map((lim) => (
                      <div
                        key={lim.title}
                        className="rounded-xl border border-dashed border-border bg-transparent px-5 py-4"
                      >
                        <p className="text-sm font-medium text-muted-foreground">
                          {lim.title}
                        </p>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground/70">
                          {lim.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
