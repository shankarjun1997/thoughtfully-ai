import { NextResponse } from "next/server";
import { ACTIVE_WORKSPACE_COOKIE, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  response.cookies.set(ACTIVE_WORKSPACE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
