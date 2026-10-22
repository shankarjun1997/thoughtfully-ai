export function safeNextPath(value: string | null | undefined, fallback = "/app") {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
