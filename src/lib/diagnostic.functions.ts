import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  companyName: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
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
  tools?: string[];
  stack?: {
    level1: StackTier;
    level2: StackTier;
    level3: StackTier;
  };
  /** Deeper layer — absent on older saved reports. */
  timeCost?: string;
  readinessTier?: "Quick Win" | "Structural Play";
  toolRationale?: string;
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

export type DiagnosticResult = {
  companyName: string;
  overallScore: number;
  scoreLabel: string;
  summary: string;
  workflows: Workflow[];
  dimensions?: Dimension[];
  limitations?: Limitation[];
};

export const runDiagnostic = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<DiagnosticResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI gateway is not configured");

    const prompt = `You are a senior AI-automation consultant. Produce a sharp, credible automation diagnostic for the company below. Be specific to its industry and size; avoid generic filler.

Company: ${data.companyName}
${data.description ? `Description: ${data.description}` : "No description provided — infer from the company name and public knowledge if available."}

Return ONLY valid JSON with this exact shape:
{
  "overallScore": <integer 0-100, where 100 = extremely high AI automation potential>,
  "scoreLabel": <short qualitative label, e.g. "High Automation Potential">,
  "summary": <2-3 sentences: what the company does and its position in its industry>,
  "workflows": [
    {
      "name": <workflow name>,
      "score": <integer 0-100 automation potential for this workflow>,
      "manualToday": <one sentence describing how this workflow is done manually today>,
      "aiApproach": <one sentence describing the suggested AI-driven automation>,
      "timeCost": <one short phrase framing time/cost, e.g. "~6 hours per week per affected employee, ~$28k/yr across the team">,
      "readinessTier": <"Quick Win" or "Structural Play">,
      "toolRationale": <1-2 sentences on why the recommended tool fits this workflow better than alternatives>,
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
Include 3 to 5 workflows, ordered by score descending. Exactly the 4 dimensions listed, in that order — the overallScore should read as a weighted composite of them. Include 3-4 limitations covering actual internal data quality, organizational political will, budget constraints, and change management capacity.`;

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

    return { companyName: data.companyName, ...validation.data };
  });
