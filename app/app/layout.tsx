import { redirect } from "next/navigation";
import { getBillingState } from "@/lib/billing/state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) return <>{children}</>;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app");

  const state = await getBillingState(supabase, user);
  if (state.requiresPayment) redirect("/subscribe?next=/app");

  return <>{children}</>;
}
