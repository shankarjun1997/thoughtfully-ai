import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code && isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const failure = new URL("/login", url.origin);
      failure.searchParams.set("error", "We could not confirm that link. Please sign in again.");
      return NextResponse.redirect(failure);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
