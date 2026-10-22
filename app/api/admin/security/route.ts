import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireVerifiedRequest } from "@/lib/security/api-gate";
import { isSecurityAdmin } from "@/lib/security/admin";

export const runtime = "nodejs";

const BUCKET = "session-verifications";
const idSchema = z.string().uuid();

export async function DELETE(request: Request) {
  const gate = await requireVerifiedRequest({ unauthenticatedMessage: "Sign in to manage security records." });
  if (!gate.ok) return gate.response;
  if (!gate.user) return NextResponse.json({ error: "Sign in to manage security records." }, { status: 401 });
  if (!isSecurityAdmin(gate.user.email)) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const parsed = idSchema.safeParse(new URL(request.url).searchParams.get("id"));
  if (!parsed.success) return NextResponse.json({ error: "Invalid verification id." }, { status: 400 });

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Photo storage is not configured." }, { status: 503 });

  const { data: row, error: lookupError } = await admin
    .from("session_verifications")
    .select("id, image_path")
    .eq("id", parsed.data)
    .maybeSingle();

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 400 });
  if (!row) return NextResponse.json({ error: "Verification not found." }, { status: 404 });

  if (row.image_path) {
    const { error: storageError } = await admin.storage.from(BUCKET).remove([row.image_path]);
    if (storageError) {
      console.warn("Could not remove verification photo", storageError.message);
      return NextResponse.json({ error: "Could not remove the stored photo. Nothing was deleted." }, { status: 500 });
    }
  }

  const { error: deleteError } = await admin.from("session_verifications").delete().eq("id", parsed.data);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
