import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isRequestAuthenticated } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  keywords: z.string().trim().min(1, "Add a few keywords or rough notes first.").max(4000, "Notes are too long (maximum 4,000 characters)."),
  purpose: z.string().trim().max(300).default("general shopping"),
  budget: z.number().finite().min(0).max(100000000).default(0),
  region: z.string().trim().max(100).default("India"),
});

const checklistSchema = z.object({
  summary: z.string(),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.string().nullable().optional(),
    estimatedPrice: z.number().nullable(),
    category: z.string().max(60),
    note: z.string().nullable().optional(),
  })).min(1),
  caveats: z.array(z.string()),
});

const outputSchema = {
  type: "object", additionalProperties: false, required: ["summary", "items", "caveats"],
  properties: {
    summary: { type: "string" },
    items: {
      type: "array", minItems: 1, items: {
        type: "object", additionalProperties: false, required: ["name", "quantity", "estimatedPrice", "category", "note"],
        properties: {
          name: { type: "string" },
          quantity: { type: ["string", "null"] },
          estimatedPrice: { type: ["number", "null"] },
          category: { type: "string", enum: ["Pooja & rituals", "Food & groceries", "Decor & flowers", "Gifts & return gifts", "Household & cleaning", "Clothing & accessories", "Equipment & rentals", "Venue & logistics", "Invites & printing", "Other"] },
          note: { type: ["string", "null"] },
        },
      },
    },
    caveats: { type: "array", items: { type: "string" } },
  },
} as const;

const instructions = "You are Thoughtfully, a careful Indian shopping and occasion planning assistant. Turn rough keywords, notes, or a loose description into a practical, well-organised shopping checklist. Use Indian retail context and INR. Give a sensible quantity for each item (for example '500 g', '2 packets', '1 set'), a realistic indicative rate in INR for that quantity, and one category from the provided enum. Group related items with the same category. Prices are estimates only; never imply live prices or availability. Keep the list focused on the stated occasion and budget, avoid duplicates, and omit items the user clearly already owns. Prefer locally available, practical options. For pooja or ritual lists, respect family, temple, priest, and regional tradition; where requirements vary, add a short note asking the user to confirm instead of asserting. Do not add unsafe or wasteful items. Respond with a single json object that matches this JSON schema exactly: " + JSON.stringify(outputSchema);

const apiKey = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY;

export async function POST(request: Request) {
  try {
    if (!(await isRequestAuthenticated())) return NextResponse.json({ error: "Sign in to use AI features." }, { status: 401 });
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: "AI is not configured yet. Add LLM_API_KEY to your server environment." }, { status: 503 });
    const client = new OpenAI({ apiKey, baseURL: process.env.LLM_BASE_URL || "https://api.deepseek.com" });
    const { keywords, purpose, budget, region } = parsed.data;
    const response = await client.chat.completions.create({
      model: process.env.LLM_MODEL || "deepseek-chat",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: JSON.stringify({ purpose, keywordsOrNotes: keywords, budgetINR: budget, region }) },
      ],
    });
    const text = response.choices[0]?.message?.content;
    if (!text) return NextResponse.json({ error: "The AI returned an empty response. Please try again." }, { status: 502 });
    const result = checklistSchema.parse(JSON.parse(text));
    return NextResponse.json({ ...result, mode: "ai" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) return NextResponse.json({ error: "The AI response could not be validated. Please try again." }, { status: 502 });
    console.error("Thoughtfully checklist generation failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to build a checklist right now. Check server configuration and try again." }, { status: 500 });
  }
}
