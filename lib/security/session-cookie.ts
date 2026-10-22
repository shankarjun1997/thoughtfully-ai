export const VERIFICATION_COOKIE = "thoughtfully_security_verified";

/**
 * The gate cookie is a signed, expiring proof that this browser completed a
 * consented verification for a specific account. It is httpOnly, so page
 * scripts cannot forge or remove the block, and it is bound to the user id so
 * switching accounts in the same browser cannot reuse it.
 *
 * Implemented with Web Crypto only so the same helper runs in middleware
 * (Edge) and in Node route handlers.
 */
export function getSessionSecret() {
  return process.env.SECURITY_SESSION_SECRET
    || process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || "";
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signPayload(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return encodeBase64Url(new Uint8Array(signature));
}

export async function createVerificationToken(userId: string, validHours: number) {
  const secret = getSessionSecret();
  if (!secret) return null;
  const expiresAt = Date.now() + validHours * 60 * 60 * 1000;
  const signature = await signPayload(`${userId}.${expiresAt}`, secret);
  return `${expiresAt}.${signature}`;
}

export async function isVerificationTokenValid(token: string | undefined | null, userId: string) {
  if (!token) return false;
  const [expiryRaw, signature] = token.split(".");
  const expiresAt = Number(expiryRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || !signature) return false;

  const secret = getSessionSecret();
  if (!secret) return false;
  const expected = await signPayload(`${userId}.${expiresAt}`, secret);
  return signature === expected;
}

export const VERIFICATION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
