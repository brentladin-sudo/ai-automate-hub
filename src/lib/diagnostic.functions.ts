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
};

export type DiagnosticResult = {
  companyName: string;
  overallScore: number;
  scoreLabel: string;
  summary: string;
  workflows: Workflow[];
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
      "tools": [<2-4 specific real AI tools or platforms relevant to this workflow, e.g. "OpenAI GPT-4o", "Zapier AI", "Intercom Fin", "UiPath", "Salesforce Einstein">]
    }
  ]
}
Include 3 to 5 workflows. Order them by score descending.`;

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
      throw new Error("Diagnostic failed — please try again");
    }

    const payload = await res.json();
    const content: string = payload.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content);

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
            tools: z.array(z.string()),
          }),
        )
        .min(3)
        .max(5),
    });

    const validated = resultSchema.parse(parsed);
    return { companyName: data.companyName, ...validated };
  });
