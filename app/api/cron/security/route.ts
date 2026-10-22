import { NextResponse } from "next/server";
import { getSecurityConfig } from "@/lib/security/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "session-verifications";
const DEVICE_RETENTION_DAYS = 180;

/**
 * Deletes verification photos past the retention window, plus stale device
 * rows. Requires CRON_SECRET so the cleanup cannot be triggered anonymously.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "Supabase admin is not configured." }, { status: 503 });

  const { retentionDays } = getSecurityConfig();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const deviceCutoff = new Date(Date.now() - DEVICE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: stale, error } = await supabase
    .from("session_verifications")
    .select("id, image_path")
    .lt("created_at", cutoff)
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const paths = (stale ?? []).map((row) => row.image_path as string).filter(Boolean);
  for (let index = 0; index < paths.length; index += 100) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths.slice(index, index + 100));
    if (storageError) console.warn("Verification cleanup could not remove photos", storageError.message);
  }

  const ids = (stale ?? []).map((row) => row.id as string);
  if (ids.length) {
    const { error: deleteError } = await supabase.from("session_verifications").delete().in("id", ids);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const { count: devicesRemoved } = await supabase
    .from("login_devices")
    .delete({ count: "exact" })
    .lt("last_seen_at", deviceCutoff);

  return NextResponse.json({
    retentionDays,
    photosRemoved: ids.length,
    devicesRemoved: devicesRemoved ?? 0,
  });
}
