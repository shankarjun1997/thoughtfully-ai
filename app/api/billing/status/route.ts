import { NextResponse } from "next/server";
import { getBillingState } from "@/lib/billing/state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ configured: false, error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const state = await getBillingState(supabase, user);
  return NextResponse.json(state);
}
