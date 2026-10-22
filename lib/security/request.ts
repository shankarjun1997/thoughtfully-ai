export type RequestContext = {
  ip: string | null;
  userAgent: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
};

function firstHeader(value: string | null) {
  const first = value?.split(",")[0]?.trim();
  return first ? first.slice(0, 200) : null;
}

function safeDecode(value: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(value).slice(0, 120);
  } catch {
    return value.slice(0, 120);
  }
}

export function describeRequest(request: Request): RequestContext {
  const headers = request.headers;
  return {
    ip: firstHeader(headers.get("x-forwarded-for")) ?? firstHeader(headers.get("x-real-ip")),
    userAgent: headers.get("user-agent")?.slice(0, 500) ?? null,
    country: headers.get("x-vercel-ip-country")?.slice(0, 8) ?? null,
    region: safeDecode(headers.get("x-vercel-ip-country-region"))?.slice(0, 80) ?? null,
    city: safeDecode(headers.get("x-vercel-ip-city"))?.slice(0, 120) ?? null,
  };
}

export function formatSecurityLocation(context: Pick<RequestContext, "city" | "region" | "country">) {
  const parts = [context.city, context.region, context.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown location";
}

export function normalizeDeviceId(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(trimmed)) return null;
  return trimmed;
}
