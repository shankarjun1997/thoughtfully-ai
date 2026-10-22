import { NextResponse } from "next/server";
import { ACTIVE_WORKSPACE_COOKIE, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { VERIFICATION_COOKIE, VERIFICATION_COOKIE_OPTIONS } from "@/lib/security/session-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "session-verifications";

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!body || body.confirm !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm account deletion." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete your account." }, { status: 401 });

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Account deletion is not configured on this deployment." }, { status: 503 });
  }

  const paths: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: rows, error: listError } = await admin
      .from("session_verifications")
      .select("image_path")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .range(from, from + 999);

    if (listError) {
      return NextResponse.json({ error: "Could not read your verification records." }, { status: 500 });
    }

    const page = (rows ?? []).map((row) => row.image_path as string).filter(Boolean);
    paths.push(...page);
    if (page.length < 1000) break;
  }

  for (let index = 0; index < paths.length; index += 100) {
    const { error: removeError } = await admin.storage.from(BUCKET).remove(paths.slice(index, index + 100));
    if (removeError) console.warn("Could not remove verification photos", removeError.message);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.warn("Account deletion failed", deleteError.message);
    return NextResponse.json({ error: "Could not delete your account. Please try again or contact support." }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true, removedPhotos: paths.length });
  response.cookies.set(VERIFICATION_COOKIE, "", { ...VERIFICATION_COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set(ACTIVE_WORKSPACE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
