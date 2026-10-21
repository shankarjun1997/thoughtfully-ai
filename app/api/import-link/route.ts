import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isRequestAuthenticated } from "@/lib/auth/guard";
import { captureScreenshot } from "@/lib/browserless";
import { fetchInstagramEmbed, parseInstagramUrl, type InstagramEmbed } from "@/lib/instagram";
import { extractTextFromImages, type CapturedImage } from "@/lib/ocr";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({ url: z.string().trim().min(1, "Paste an Instagram link first.").max(500) });

const resultSchema = z.object({
  summary: z.string(),
  checklist: z.array(z.object({
    name: z.string(),
    quantity: z.string().nullable().optional(),
    estimatedPrice: z.number().nullable().optional(),
    category: z.string().max(60),
    note: z.string().nullable().optional(),
  })).min(1),
  actions: z.array(z.object({
    title: z.string(),
    detail: z.string(),
    timeframe: z.string().nullable().optional(),
  })).default([]),
  caveats: z.array(z.string()).default([]),
});

const outputSchema = {
  type: "object", additionalProperties: false, required: ["summary", "checklist", "actions", "caveats"],
  properties: {
    summary: { type: "string" },
    checklist: {
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
    actions: {
      type: "array", items: {
        type: "object", additionalProperties: false, required: ["title", "detail", "timeframe"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          timeframe: { type: ["string", "null"] },
        },
      },
    },
    caveats: { type: "array", items: { type: "string" } },
  },
} as const;

const instructions = "You are Thoughtfully, a careful Indian planning assistant. Read the supplied Instagram caption and OCR text from its slides or screenshot, then extract a practical shopping checklist and an action plan. Use only information present in the supplied text; OCR may contain errors, so correct obvious misspellings but do not invent products, brands, prices or steps. Turn ingredients, materials, products, quantities and supplies mentioned in the post into checklist items, each assigned one category from the provided enum. Give a sensible quantity when stated or clearly implied, otherwise null. If a price is explicitly shown, use it; otherwise give a realistic indicative INR estimate and mark it as an estimate by putting 'Estimated rate' in the note. Turn every preparation step, instruction or task in the post into an action with a short timeframe when stated (for example 'Day before', 'Morning of'), otherwise null. Keep the checklist and actions focused and de-duplicated. If the post is not a checklist or plan, summarise it and derive only the actions a reader would reasonably take, with caveats. Respond with a single json object that matches this JSON schema exactly: " + JSON.stringify(outputSchema);

const llmKey = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY;

async function downloadImages(urls: string[]): Promise<CapturedImage[]> {
  const results = await Promise.all(urls.slice(0, 6).map(async (url) => {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0", accept: "image/avif,image/webp,image/jpeg,image/png,*/*" },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) return null;
      const mime = (response.headers.get("content-type") ?? "").split(";")[0] || "image/jpeg";
      if (!mime.startsWith("image/")) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength < 2000 || buffer.byteLength > 8_000_000) return null;
      return { buffer, mime };
    } catch {
      return null;
    }
  }));
  return results.filter((image) => image !== null) as CapturedImage[];
}

export async function POST(request: Request) {
  try {
    if (!(await isRequestAuthenticated())) return NextResponse.json({ error: "Sign in to use AI features." }, { status: 401 });
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

    const source = parseInstagramUrl(parsed.data.url);
    if (!source) return NextResponse.json({ error: "That does not look like an Instagram post or reel link." }, { status: 400 });
    if (!llmKey) return NextResponse.json({ error: "AI is not configured yet. Add LLM_API_KEY to your server environment." }, { status: 503 });

    let embed: InstagramEmbed = { title: "", caption: "", images: [] };
    try {
      embed = await fetchInstagramEmbed(source);
    } catch (error) {
      console.warn("Instagram embed fetch failed", error instanceof Error ? error.message : "Unknown error");
    }

    let captured = await downloadImages(embed.images);
    let capture: "slides" | "screenshot" = "slides";
    if (!captured.length) {
      const screenshot = await captureScreenshot(source.embedUrl);
      if (!screenshot) {
        return NextResponse.json({
          error: "Could not read this post. Add BROWSERLESS_TOKEN for screenshot capture, or try a public post whose slides can be read directly.",
        }, { status: 502 });
      }
      captured = [{ buffer: screenshot, mime: "image/png" }];
      capture = "screenshot";
    }

    const ocrTexts = await extractTextFromImages(captured).catch((error) => {
      console.warn("OCR failed", error instanceof Error ? error.message : "Unknown error");
      return [] as string[];
    });
    const combined = [embed.caption, embed.title, ...ocrTexts].filter((text) => text.trim()).join("\n\n").slice(0, 24000);
    if (combined.replace(/\s/g, "").length < 20) {
      return NextResponse.json({ error: "We could not find enough readable text in this post. Try another public post or paste the caption as text." }, { status: 422 });
    }

    const client = new OpenAI({ apiKey: llmKey, baseURL: process.env.LLM_BASE_URL || "https://api.deepseek.com" });
    const response = await client.chat.completions.create({
      model: process.env.LLM_MODEL || "deepseek-chat",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: JSON.stringify({ sourceUrl: source.canonicalUrl, caption: embed.caption, title: embed.title, ocrText: ocrTexts.join("\n\n--- slide ---\n\n") }) },
      ],
    });
    const text = response.choices[0]?.message?.content;
    if (!text) return NextResponse.json({ error: "The AI returned an empty response. Please try again." }, { status: 502 });

    const result = resultSchema.parse(JSON.parse(text));
    return NextResponse.json({
      ...result,
      mode: "ai",
      source: { url: source.canonicalUrl, shortcode: source.shortcode, kind: source.kind, slides: captured.length, capture },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      return NextResponse.json({ error: "The extracted plan could not be validated. Please try again." }, { status: 502 });
    }
    console.error("Instagram import failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to import this link right now. Please try again." }, { status: 500 });
  }
}
