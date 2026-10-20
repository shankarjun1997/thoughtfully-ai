import OpenAI from "openai";

export type CapturedImage = { buffer: Buffer; mime: string };

const visionKey = process.env.VISION_API_KEY;

async function visionOcr(image: CapturedImage): Promise<string> {
  if (!visionKey) return "";
  const client = new OpenAI({ apiKey: visionKey, baseURL: process.env.VISION_BASE_URL || "https://api.openai.com/v1" });
  const response = await client.chat.completions.create({
    model: process.env.VISION_MODEL || "gpt-4o-mini",
    max_tokens: 1200,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "Extract every piece of readable text from this Instagram slide or screenshot. Preserve headings, numbered steps, lists, prices and quantities. Return plain text only; do not describe the image." },
        { type: "image_url", image_url: { url: `data:${image.mime};base64,${image.buffer.toString("base64")}` } },
      ],
    }],
  });
  return response.choices[0]?.message?.content?.trim() ?? "";
}

async function tesseractOcr(images: CapturedImage[]): Promise<string[]> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, { cachePath: "/tmp", logger: () => {} });
  try {
    const results: string[] = [];
    for (const image of images) {
      const { data } = await worker.recognize(image.buffer);
      results.push(data.text.trim());
    }
    return results;
  } finally {
    await worker.terminate().catch(() => {});
  }
}

export async function extractTextFromImages(images: CapturedImage[]): Promise<string[]> {
  if (!images.length) return [];
  if (visionKey) {
    const results: string[] = [];
    for (const image of images) results.push(await visionOcr(image).catch(() => ""));
    return results;
  }
  return tesseractOcr(images);
}
