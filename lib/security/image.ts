export const MAX_VERIFICATION_BYTES = 2_500_000;

const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type VerificationMime = keyof typeof MIME_EXTENSIONS;

export type ParsedVerificationImage = {
  mimeType: VerificationMime;
  extension: string;
  bytes: Buffer;
};

/**
 * Accepts only the data URL produced by the consent screen. SVG and GIF are
 * deliberately rejected so no script-capable or animated content reaches the
 * private bucket or the administrator inbox.
 */
export function parseImageDataUrl(value: unknown): ParsedVerificationImage | null {
  if (typeof value !== "string") return null;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(value.trim());
  if (!match) return null;

  const mimeType = match[1] as VerificationMime;
  const base64 = match[2].replace(/\s+/g, "");
  if (!base64 || base64.length > Math.ceil((MAX_VERIFICATION_BYTES * 4) / 3) + 8) return null;

  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > MAX_VERIFICATION_BYTES) return null;

  return { mimeType, extension: MIME_EXTENSIONS[mimeType], bytes };
}
