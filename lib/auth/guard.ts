import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * AI endpoints stay open in local mode, but require a signed-in user once
 * Supabase auth is configured so workspace tenants cannot be billed for anonymous use.
 */
export async function isRequestAuthenticated() {
  if (!isSupabaseConfigured) return true;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return Boolean(user);
}
