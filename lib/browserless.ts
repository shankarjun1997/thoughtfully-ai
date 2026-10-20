export async function captureScreenshot(url: string): Promise<Buffer | null> {
  const token = process.env.BROWSERLESS_TOKEN;
  if (!token) return null;

  const base = (process.env.BROWSERLESS_URL || "https://production-sfo.browserless.io").replace(/\/$/, "");
  const response = await fetch(`${base}/screenshot?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      options: { fullPage: true, type: "png" },
      gotoOptions: { waitUntil: "networkidle2", timeout: 30000 },
      waitForTimeout: 3500,
      viewport: { width: 900, height: 1200, deviceScaleFactor: 1 },
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Screenshot capture failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
