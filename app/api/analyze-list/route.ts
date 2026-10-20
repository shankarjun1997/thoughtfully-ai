import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isRequestAuthenticated } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  items: z.string().trim().min(1, "Paste at least one item.").max(12000, "List is too long (maximum 12,000 characters)."),
  purpose: z.string().trim().max(300).default("general shopping"),
  budget: z.number().finite().min(0).max(100000000).default(0),
  region: z.string().trim().max(100).default("India"),
  ownedItems: z.array(z.string().trim().max(160)).max(100).optional().default([]),
});

const analysisSchema = z.object({
  summary: z.string(),
  totalEstimated: z.number().nullable(),
  budgetStatus: z.string(),
  recommendations: z.array(z.object({
    item: z.string(),
    action: z.enum(["keep", "consider", "remove", "add"]),
    reason: z.string(),
    estimatedPrice: z.number().nullable().optional(),
  })),
  missingEssentials: z.array(z.string()),
  savingsTips: z.array(z.string()),
  caveats: z.array(z.string()),
});

const outputSchema = {
  type: "object", additionalProperties: false, required: ["summary", "totalEstimated", "budgetStatus", "recommendations", "missingEssentials", "savingsTips", "caveats"],
  properties: {
    summary: { type: "string" }, totalEstimated: { type: ["number", "null"] }, budgetStatus: { type: "string" },
    recommendations: { type: "array", items: { type: "object", additionalProperties: false, required: ["item", "action", "reason"], properties: { item: { type: "string" }, action: { type: "string", enum: ["keep", "consider", "remove", "add"] }, reason: { type: "string" }, estimatedPrice: { type: ["number", "null"] } } } },
    missingEssentials: { type: "array", items: { type: "string" } }, savingsTips: { type: "array", items: { type: "string" } }, caveats: { type: "array", items: { type: "string" } }
  }
} as const;

const instructions = "You are Thoughtfully, a careful Indian shopping and occasion planning assistant. Analyze lists with cultural sensitivity. Do not invent live prices or availability. Parse user-provided prices only; if unknown, use null and label uncertainty. Never call an item unnecessary without contextual evidence. For pooja or ritual lists, do not override family, temple, priest, or tradition-specific requirements; flag uncertainty and ask the user to confirm. Identify duplicates, optional items, missing essentials only when justified by the stated purpose, practical substitutions, and budget tradeoffs. Avoid unsafe or wasteful recommendations. Respond with a single json object that matches this JSON schema exactly: " + JSON.stringify(outputSchema);

const apiKey = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY;

export async function POST(request: Request) {
  try {
    if (!(await isRequestAuthenticated())) return NextResponse.json({ error: "Sign in to use AI features." }, { status: 401 });
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: "AI is not configured yet. Add LLM_API_KEY to your server environment. The app's local rules preview can still be used." }, { status: 503 });
    const client = new OpenAI({ apiKey, baseURL: process.env.LLM_BASE_URL || "https://api.deepseek.com" });
    const { items, purpose, budget, region, ownedItems } = parsed.data;
    const response = await client.chat.completions.create({
      model: process.env.LLM_MODEL || "deepseek-chat",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: JSON.stringify({ purpose, budgetINR: budget, region, listToReview: items, itemsAlreadyOwned: ownedItems }) },
      ],
    });
    const text = response.choices[0]?.message?.content;
    if (!text) return NextResponse.json({ error: "The AI returned an empty response. Please try again." }, { status: 502 });
    const result = analysisSchema.parse(JSON.parse(text));
    return NextResponse.json({ ...result, mode: "ai" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) return NextResponse.json({ error: "The AI response could not be validated. Please try again." }, { status: 502 });
    console.error("Thoughtfully list analysis failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to analyze this list right now. Check server configuration and try again." }, { status: 500 });
  }
}
