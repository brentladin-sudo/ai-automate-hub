import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, RotateCcw, Sparkles, Wrench } from "lucide-react";
import { runDiagnostic, type DiagnosticResult } from "@/lib/diagnostic.functions";

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
    const t = window.setTimeout(() => setSettled(true), 150 + delay);
    return () => window.clearTimeout(t);
  }, [delay]);

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

function Index() {
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

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
      setResult(res);
    } catch {
      setError("The diagnostic couldn't complete. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setCompanyName("");
    setDescription("");
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(70%_50%_at_50%_-10%,oklch(0.72_0.19_235/12%),transparent_70%)]" />
      <div className="relative mx-auto max-w-3xl px-6 pb-24">
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
            <div className="animate-rise flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-widest text-primary uppercase">
                  Diagnostic Report
                </p>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                  {result.companyName}
                </h2>
              </div>
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New diagnostic
              </button>
            </div>

            <section
              className="animate-rise mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8"
              style={{ animationDelay: "120ms" }}
            >
              <ScoreRail score={result.overallScore} size="lg" />
              <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-display text-5xl font-bold tracking-tight text-primary">
                  {result.overallScore}
                  <span className="text-2xl text-muted-foreground">/100</span>
                </span>
                <span className="text-base font-semibold">{result.scoreLabel}</span>
              </div>
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
                </article>
              ))}
            </div>

            <h3
              className="animate-rise mt-12 font-display text-xl font-bold tracking-tight"
              style={{ animationDelay: `${400 + result.workflows.length * 90}ms` }}
            >
              Recommended Stack
            </h3>
            <div
              className="animate-rise mt-5 space-y-3"
              style={{ animationDelay: `${460 + result.workflows.length * 90}ms` }}
            >
              {result.workflows.map((wf) => (
                <div
                  key={wf.name}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-5 py-4"
                >
                  <span className="min-w-40 text-sm font-semibold">{wf.name}</span>
                  <div className="flex flex-wrap gap-2">
                    {wf.tools.map((tool) => (
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
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
