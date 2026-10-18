import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 30;
const requestSchema = z.object({
  items: z.string().trim().min(1, "Paste at least one item.").max(12000, "List is too long (maximum 12,000 characters)."),
  purpose: z.string().trim().max(300).default("general shopping"),
  budget: z.number().finite().min(0).max(100000000).default(0),
  region: z.string().trim().max(100).default("India"),
  ownedItems: z.array(z.string().trim().max(160)).max(100).optional().default([]),
});
const outputSchema = {
  type: "object", additionalProperties: false, required: ["summary", "totalEstimated", "budgetStatus", "recommendations", "missingEssentials", "savingsTips", "caveats"],
  properties: {
    summary: { type: "string" }, totalEstimated: { type: ["number", "null"] }, budgetStatus: { type: "string" },
    recommendations: { type: "array", items: { type: "object", additionalProperties: false, required: ["item", "action", "reason"], properties: { item: { type: "string" }, action: { type: "string", enum: ["keep", "consider", "remove", "add"] }, reason: { type: "string" }, estimatedPrice: { type: ["number", "null"] } } } },
    missingEssentials: { type: "array", items: { type: "string" } }, savingsTips: { type: "array", items: { type: "string" } }, caveats: { type: "array", items: { type: "string" } }
  }
} as const;

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI is not configured yet. Add OPENAI_API_KEY to your server environment. The app's local rules preview can still be used." }, { status: 503 });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { items, purpose, budget, region, ownedItems } = parsed.data;
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      store: false,
      instructions: "You are Thoughtfully, a careful Indian shopping and occasion planning assistant. Analyze lists with cultural sensitivity. Do not invent live prices or availability. Parse user-provided prices only; if unknown, use null and label uncertainty. Never call an item unnecessary without contextual evidence. For pooja or ritual lists, do not override family, temple, priest, or tradition-specific requirements; flag uncertainty and ask the user to confirm. Identify duplicates, optional items, missing essentials only when justified by the stated purpose, practical substitutions, and budget tradeoffs. Avoid unsafe or wasteful recommendations. Return only the requested structured object.",
      input: JSON.stringify({ purpose, budgetINR: budget, region, listToReview: items, itemsAlreadyOwned: ownedItems }),
      text: { format: { type: "json_schema", name: "thoughtfully_list_analysis", strict: true, schema: outputSchema } },
    });
    const text = response.output_text;
    if (!text) return NextResponse.json({ error: "The AI returned an empty response. Please try again." }, { status: 502 });
    const result = JSON.parse(text);
    return NextResponse.json({ ...result, mode: "ai" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "The AI response could not be validated. Please try again." }, { status: 502 });
    console.error("Thoughtfully list analysis failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to analyze this list right now. Check server configuration and try again." }, { status: 500 });
  }
}
