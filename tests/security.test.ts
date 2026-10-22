import { describe, expect, it } from "vitest";
import { escapeHtml } from "../lib/security/email";
import { parseImageDataUrl } from "../lib/security/image";
import { describeRequest, formatSecurityLocation, normalizeDeviceId } from "../lib/security/request";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("parseImageDataUrl", () => {
  it("accepts the JPEG, PNG and WebP data URLs produced by the consent screen", () => {
    expect(parseImageDataUrl(PNG_1PX)).toMatchObject({ mimeType: "image/png", extension: "png" });
    expect(parseImageDataUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toMatchObject({ mimeType: "image/jpeg", extension: "jpg" });
    expect(parseImageDataUrl("data:image/webp;base64,UklGRg==")).toMatchObject({ mimeType: "image/webp", extension: "webp" });
  });

  it("rejects script-capable, animated and malformed payloads", () => {
    expect(parseImageDataUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBeNull();
    expect(parseImageDataUrl("data:image/gif;base64,R0lGODlhAQABAAAAACw=")).toBeNull();
    expect(parseImageDataUrl("data:text/plain;base64,aGVsbG8=")).toBeNull();
    expect(parseImageDataUrl("https://example.com/photo.jpg")).toBeNull();
    expect(parseImageDataUrl(null)).toBeNull();
  });

  it("rejects photos over the 2.5 MB limit", () => {
    const oversized = `data:image/jpeg;base64,${"A".repeat(3_600_000)}`;
    expect(parseImageDataUrl(oversized)).toBeNull();
  });
});

describe("request context", () => {
  it("extracts client IP, Vercel geo headers and user agent", () => {
    const context = describeRequest(new Request("https://example.com", {
      headers: {
        "x-forwarded-for": "203.0.113.9, 10.0.0.1",
        "user-agent": "Mozilla/5.0 TestBrowser",
        "x-vercel-ip-country": "IN",
        "x-vercel-ip-country-region": "KA",
        "x-vercel-ip-city": "Bengaluru",
      },
    }));
    expect(context).toMatchObject({ ip: "203.0.113.9", country: "IN", region: "KA", city: "Bengaluru", userAgent: "Mozilla/5.0 TestBrowser" });
    expect(formatSecurityLocation(context)).toBe("Bengaluru, KA, IN");
  });

  it("falls back gracefully when location headers are missing", () => {
    const context = describeRequest(new Request("https://example.com"));
    expect(context).toMatchObject({ ip: null, country: null, city: null });
    expect(formatSecurityLocation(context)).toBe("Unknown location");
  });

  it("validates device identifiers before they reach the database", () => {
    expect(normalizeDeviceId("8f14e45f-ceea-467f-a8d0-2d7c1f1a6b21")).toBe("8f14e45f-ceea-467f-a8d0-2d7c1f1a6b21");
    expect(normalizeDeviceId("short")).toBeNull();
    expect(normalizeDeviceId("has spaces 1234")).toBeNull();
    expect(normalizeDeviceId("a".repeat(129))).toBeNull();
    expect(normalizeDeviceId(42)).toBeNull();
  });
});

describe("escapeHtml", () => {
  it("neutralises markup in email fields", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
});
