import { NextResponse } from "next/server";
import { ACTIVE_WORKSPACE_COOKIE, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { VERIFICATION_COOKIE, VERIFICATION_COOKIE_OPTIONS } from "@/lib/security/session-cookie";

export async function POST(request: Request) {
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  response.cookies.set(ACTIVE_WORKSPACE_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(VERIFICATION_COOKIE, "", { ...VERIFICATION_COOKIE_OPTIONS, maxAge: 0 });
  return response;
}
