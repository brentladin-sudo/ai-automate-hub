import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  companyName: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  websiteUrl: z.string().max(300).optional(),
});

export type StackTier = {
  approach: string;
  tools: string[];
};

export type Workflow = {
  name: string;
  score: number;
  manualToday: string;
  aiApproach: string;
  /** Legacy single-tier stack (older saved reports). */
  tools?: string[] | undefined;
  stack?:
    | {
        level1: StackTier;
        level2: StackTier;
        level3: StackTier;
      }
    | undefined;
  /** Deeper layer — absent on older saved reports. */
  timeCost?: string | undefined;
  readinessTier?: "Quick Win" | "Structural Play" | undefined;
  toolRationale?: string | undefined;
  riskFactors?: string | undefined;
  ownership?: string | undefined;
};

export type Dimension = {
  name: string;
  score: number;
  explanation: string;
};

export type Limitation = {
  title: string;
  detail: string;
};

export type CompanySnapshot = {
  whatTheyDo: string;
  sizeAndFootprint: string;
  businessModel: string;
  keyContext: string;
};

export type ExistingStackTool = {
  name: string;
  use: string;
};

export type ExistingStack = {
  tools: ExistingStackTool[];
  /** Whether the tools above are grounded in something checkable vs. a plausible guess. */
  confidence: "inferred" | "unknown";
  /** Explains what was/wasn't checked, or why nothing was found. */
  note: string;
};

export type SiteSignal = {
  label: string;
  present: boolean;
};

export type SiteCheck = {
  url: string;
  fetchedOk: boolean;
  signals: SiteSignal[];
  primaryCta: string | null;
  /** What was checked, or why the check didn't happen — always shown, success or failure. */
  note: string;
};

export type DiagnosticResult = {
  companyName: string;
  overallScore: number;
  scoreLabel: string;
  /** Legacy flat summary (older saved reports). Superseded by `snapshot` when present. */
  summary: string;
  snapshot?: CompanySnapshot | undefined;
  existingStack?: ExistingStack | undefined;
  /** Present only when a website URL was submitted. Computed directly from the fetched
   * HTML server-side — not LLM output — so it's accurate regardless of what the model does with it. */
  siteCheck?: SiteCheck | undefined;
  workflows: Workflow[];
  dimensions?: Dimension[] | undefined;
  limitations?: Limitation[] | undefined;
};

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true;
  const a = parts[0]!;
  const b = parts[1]!;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata endpoint
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local fc00::/7
  if (lower.startsWith("::ffff:")) return isPrivateOrReservedIpv4(lower.slice(7));
  return false;
}

/** Rejects hostnames that are obviously private/loopback/link-local, guarding against
 * the server being used to probe internal network endpoints (SSRF) via a user-supplied
 * "company website" URL.
 *
 * This deploys to Cloudflare Workers (Nitro's cloudflare preset — see vite.config.ts),
 * which doesn't support Node's `dns` module, so a real hostname resolve-then-check isn't
 * available here. This is defense-in-depth for the obvious cases (someone typing
 * "localhost" or a raw private IP directly) — the primary backstop against DNS-rebinding
 * style SSRF is the Workers platform itself, which sandboxes outbound fetch() from ever
 * reaching private/internal/loopback IP ranges regardless of what a Worker's code does. */
function isSafeHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (lower === "localhost" || lower.endsWith(".localhost") || lower === "0.0.0.0") return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(lower)) return !isPrivateOrReservedIpv4(lower);
  if (lower.includes(":")) return !isPrivateOrReservedIpv6(lower);
  return true;
}

const SIGNAL_PATTERNS: { label: string; patterns: RegExp[] }[] = [
  {
    label: "Online booking / scheduling",
    patterns: [
      /calendly\.com/,
      /opentable\.com/,
      /acuityscheduling\.com/,
      /squareup\.com\/appointments/,
      /book\s*(a|an)?\s*(table|appointment|demo|call|room|now)/,
      /schedule\s*(a|an)?\s*(demo|call|appointment|consultation)/,
    ],
  },
  {
    label: "Live chat widget",
    patterns: [
      /widget\.intercom\.io|intercom\.io\/embed/,
      /js\.driftt\.com/,
      /static\.zdassets\.com/,
      /embed\.tawk\.to/,
      /client\.crisp\.chat/,
      /livechatinc\.com/,
    ],
  },
  {
    label: "Online payments / e-commerce",
    patterns: [
      /js\.stripe\.com|checkout\.stripe\.com/,
      /cdn\.shopify\.com/,
      /paypal\.com\/sdk/,
      /add[\s-]*to[\s-]*cart/i,
      /woocommerce/,
    ],
  },
];

const MAX_REDIRECTS = 4;

/** Returns a failure note if this URL isn't safe to fetch, or null if it's clear to proceed. */
function unsafeUrlReason(url: URL): string | null {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "Only http/https website URLs are supported, so this report falls back to inference only.";
  }
  if (!isSafeHostname(url.hostname)) {
    return "This hostname isn't allowed, so this report falls back to inference only.";
  }
  return null;
}

async function checkWebsite(rawUrl: string): Promise<SiteCheck> {
  const fail = (note: string, url = rawUrl): SiteCheck => ({
    url,
    fetchedOk: false,
    signals: [],
    primaryCta: null,
    note,
  });

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  } catch {
    return fail("The provided website URL couldn't be parsed, so this report falls back to inference only.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    // Bounded redirect following: real company sites routinely redirect apex <-> www or
    // http -> https, so refusing all redirects would make this feature rarely succeed.
    // Each hop is re-validated for SSRF safety before being fetched — a redirect can't be
    // used to smuggle a request to a private/internal address past the initial check.
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const unsafe = unsafeUrlReason(url);
      if (unsafe) return fail(unsafe, url.toString());

      const res = await fetch(url.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; GoAutomateBot/1.0)" },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location || hop === MAX_REDIRECTS) {
          return fail(
            "This website redirected too many times (or to an invalid destination), so this report falls back to inference only.",
            url.toString(),
          );
        }
        try {
          url = new URL(location, url);
        } catch {
          return fail("This website redirected to an unparseable URL, so this report falls back to inference only.", url.toString());
        }
        continue;
      }

      if (!res.ok) {
        return fail(`The website returned HTTP ${res.status}, so this report falls back to inference only.`, url.toString());
      }

      const html = (await res.text()).slice(0, 500_000);
      const lower = html.toLowerCase();

      const signals: SiteSignal[] = SIGNAL_PATTERNS.map(({ label, patterns }) => ({
        label,
        present: patterns.some((p) => p.test(lower)),
      }));

      const ctaCandidates = [...html.matchAll(/<(?:a|button)[^>]*>\s*([^<]{2,40}?)\s*<\/(?:a|button)>/gi)]
        .map((m) => (m[1] ?? "").replace(/\s+/g, " ").trim())
        .filter((text) => /get started|book|schedule|sign up|contact|buy|shop|order now|start|try|demo|learn more|call us/i.test(text));

      return {
        url: url.toString(),
        fetchedOk: true,
        signals,
        primaryCta: ctaCandidates[0] ?? null,
        note: "These signals were detected directly from the company's homepage HTML — a real check, not an LLM guess.",
      };
    }
    return fail("This website redirected too many times, so this report falls back to inference only.", url.toString());
  } catch {
    return fail("Couldn't reach this website (timeout or network error), so this report falls back to inference only.", url.toString());
  } finally {
    clearTimeout(timeoutId);
  }
}

export const runDiagnostic = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<DiagnosticResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI gateway is not configured");

    const siteCheck = data.websiteUrl ? await checkWebsite(data.websiteUrl) : undefined;

    const groundingBlock =
      siteCheck?.fetchedOk
        ? `\nVerified facts from the company's actual website (${siteCheck.url}) — these were extracted directly from the live page, not guessed. Treat them as confirmed ground truth: cite them explicitly in "whatTheyDo", "businessModel", or "keyContext" where relevant, and never state anything that contradicts them. Everything else about this company remains unverified and must still be framed as inference.\n${siteCheck.signals
            .map((s) => `- ${s.label}: ${s.present ? "present on the site" : "not detected on the site"}`)
            .join("\n")}\n- Primary call-to-action on homepage: ${siteCheck.primaryCta ? `"${siteCheck.primaryCta}"` : "none clearly detected"}\n`
        : "";

    const prompt = `You are a senior AI-automation consultant. Produce a sharp, credible automation diagnostic for the company below. Be specific to its industry and size; avoid generic filler.

Company: ${data.companyName}
${data.description ? `Description: ${data.description}` : "No description provided — infer from the company name and public knowledge if available."}
${groundingBlock}
Return ONLY valid JSON with this exact shape:
{
  "overallScore": <integer 0-100, where 100 = extremely high AI automation potential>,
  "scoreLabel": <short qualitative label, e.g. "High Automation Potential">,
  "summary": <2-3 sentences: what the company does and its position in its industry>,
  "snapshot": {
    "whatTheyDo": <2-3 sentences: what the company actually does and its position in its industry>,
    "sizeAndFootprint": <one sentence: best estimate of company size (employee count or SMB/mid-market/enterprise) and where it operates (HQ, regions). If this can't be known, say so explicitly rather than inventing a number>,
    "businessModel": <one sentence: how the company makes money (B2B/B2C, product vs. service, subscription vs. transactional, etc.)>,
    "keyContext": <one sentence: an operational detail relevant to automation potential, e.g. how labor-intensive operations are, tech-forward vs legacy, growth signals>
  },
  "existingStack": {
    "tools": [
      { "name": <a specific, real, publicly-plausible tool/platform this company likely already uses, e.g. based on its industry and size>, "use": <one short phrase on what it's likely used for> }
    ],
    "confidence": <"inferred" if you are naming plausible tools based on industry/size patterns rather than confirmed facts, "unknown" if you have no reasonable basis to guess>,
    "note": <one sentence stating plainly that this list is inferred from general patterns for the industry/size (not confirmed from the company's actual public data), or, if confidence is "unknown", explaining that nothing could be reasonably inferred>
  },
  "workflows": [
    {
      "name": <workflow name>,
      "score": <integer 0-100 automation potential for this workflow>,
      "manualToday": <one sentence describing how this workflow is done manually today>,
      "aiApproach": <one sentence describing the suggested AI-driven automation>,
      "timeCost": <one short phrase framing time/cost, e.g. "~6 hours per week per affected employee, ~$28k/yr across the team">,
      "readinessTier": <"Quick Win" or "Structural Play">,
      "toolRationale": <1-2 sentences on why the recommended tool fits this workflow better than alternatives>,
      "riskFactors": <one sentence naming the main risk in adopting this specific automation — whichever is most relevant: data quality, integration fragility, or a customer-facing failure mode>,
      "ownership": <one short phrase on who would implement this, e.g. "Business owner can configure directly", "Needs a part-time ops hire", "Best handled by the software vendor's onboarding team">,
      "stack": {
        "level1": { "approach": <one sentence: quick, low-effort no-code fix shippable in days>, "tools": [<2-3 real off-the-shelf tools>] },
        "level2": { "approach": <one sentence: mid-effort integrated solution, weeks of work>, "tools": [<2-4 real tools/platforms>] },
        "level3": { "approach": <one sentence: bespoke engineered system, months of work>, "tools": [<2-4 real platforms, models, or infrastructure>] }
      }
    }
  ],
  "dimensions": [
    { "name": "Data Readiness", "score": <0-100>, "explanation": <one sentence on how structured and accessible this company's data is> },
    { "name": "Process Repeatability", "score": <0-100>, "explanation": <one sentence on how rule-based vs judgment-heavy the core workflows are> },
    { "name": "Integration Complexity", "score": <0-100, higher = EASIER to integrate / less legacy lock-in>, "explanation": <one sentence on legacy system lock-in> },
    { "name": "Change Management Risk", "score": <0-100, higher = LESS resistance expected>, "explanation": <one sentence on likely organizational resistance to AI adoption> }
  ],
  "limitations": [
    { "title": <short caveat title>, "detail": <one sentence on what this diagnostic cannot see> }
  ]
}
Level 1 = simple/off-the-shelf, Level 2 = integrated/configured, Level 3 = custom-built and deeply integrated. Tools must be real and specific (e.g. "Zapier AI", "Intercom Fin", "OpenAI GPT-4o", "UiPath", "LangGraph", "Snowflake Cortex").
Include 3 to 5 workflows, ordered by score descending. Exactly the 4 dimensions listed, in that order — the overallScore should read as a weighted composite of them. Include 3-4 limitations covering actual internal data quality, organizational political will, budget constraints, and change management capacity.
Be honest about what you don't actually know: ${siteCheck?.fetchedOk ? "aside from the verified website facts given above, you have" : "you have"} no real-time access to this company's job postings or tech stack, so "existingStack" and "sizeAndFootprint" must read as reasoned inferences from public patterns for companies like this one — never state a specific fact (an exact employee count, a confirmed tool in use) as if it were verified unless it was given to you above as a verified website fact. If you have no reasonable basis to infer likely tools at all, return an empty "tools" array with "confidence": "unknown" and explain why in "note" rather than inventing plausible-sounding ones.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("AI gateway error", res.status, text);
      if (res.status === 401 || res.status === 403) {
        throw new Error("Diagnostic failed — the AI gateway rejected our credentials. Check LOVABLE_API_KEY.");
      }
      if (res.status === 429) {
        throw new Error("Diagnostic failed — the AI gateway is rate-limited. Please wait a moment and try again.");
      }
      throw new Error(`Diagnostic failed — AI gateway returned ${res.status}. Please try again.`);
    }

    const payload = await res.json();
    const rawContent: string = payload.choices?.[0]?.message?.content ?? "";
    // Some models wrap JSON in ```json ... ``` fences even when response_format
    // is requested. Strip those defensively before parsing.
    const content = rawContent
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "");

    if (!content) {
      console.error("AI gateway returned empty content", payload);
      throw new Error("Diagnostic failed — the AI returned an empty response. Please try again.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error("Failed to parse AI response as JSON", err, "raw content:", content);
      throw new Error("Diagnostic failed — the AI response was malformed. Please try again.");
    }

    const tierSchema = z.object({
      approach: z.string(),
      tools: z.array(z.string()),
    });

    const resultSchema = z.object({
      overallScore: z.number().min(0).max(100),
      scoreLabel: z.string(),
      summary: z.string(),
      snapshot: z
        .object({
          whatTheyDo: z.string(),
          sizeAndFootprint: z.string(),
          businessModel: z.string(),
          keyContext: z.string(),
        })
        .optional(),
      existingStack: z
        .object({
          tools: z.array(z.object({ name: z.string(), use: z.string() })),
          confidence: z.enum(["inferred", "unknown"]),
          note: z.string(),
        })
        .optional(),
      workflows: z
        .array(
          z.object({
            name: z.string(),
            score: z.number().min(0).max(100),
            manualToday: z.string(),
            aiApproach: z.string(),
            timeCost: z.string().optional(),
            readinessTier: z.enum(["Quick Win", "Structural Play"]).optional(),
            toolRationale: z.string().optional(),
            riskFactors: z.string().optional(),
            ownership: z.string().optional(),
            stack: z.object({
              level1: tierSchema,
              level2: tierSchema,
              level3: tierSchema,
            }),
          }),
        )
        .min(3)
        .max(5),
      dimensions: z
        .array(
          z.object({
            name: z.string(),
            score: z.number().min(0).max(100),
            explanation: z.string(),
          }),
        )
        .optional(),
      limitations: z
        .array(z.object({ title: z.string(), detail: z.string() }))
        .optional(),
    });

    const validation = resultSchema.safeParse(parsed);
    if (!validation.success) {
      console.error(
        "AI response failed schema validation",
        validation.error.flatten(),
        "raw parsed content:",
        parsed,
      );
      throw new Error("Diagnostic failed — the AI response didn't match the expected format. Please try again.");
    }

    return { companyName: data.companyName, siteCheck, ...validation.data };
  });
