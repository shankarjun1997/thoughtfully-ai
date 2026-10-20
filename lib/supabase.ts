import { createSupabaseBrowserClient } from "./supabase/client";

/** Optional browser client. Returns null until public Supabase env vars are configured. */
export function getSupabaseBrowserClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  return createSupabaseBrowserClient();
}
