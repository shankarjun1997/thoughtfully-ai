import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSecurityConfig } from "@/lib/security/config";
import { SESSION_CONSENT_VERSION } from "@/lib/security/consent";
import { sendSecurityEmail } from "@/lib/security/email";
import { parseImageDataUrl } from "@/lib/security/image";
import { describeRequest, formatSecurityLocation, normalizeDeviceId } from "@/lib/security/request";

export const runtime = "nodejs";
export const maxDuration = 30;

const BUCKET = "session-verifications";
const MIN_SECONDS_BETWEEN_VERIFICATIONS = 60;

const bodySchema = z.object({
  deviceId: z.string().min(8).max(128),
  consentVersion: z.string().min(1).max(40),
  image: z.string().min(32).max(4_000_000),
});

async function authenticated() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * Stores a consent photo in the private bucket and emails it to the security
 * administrator. The request is rejected unless the consent version matches
 * the copy shown in the UI, so a stale or forged consent cannot be recorded.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid verification request." }, { status: 400 });
  if (parsed.data.consentVersion !== SESSION_CONSENT_VERSION) {
    return NextResponse.json({ error: "The consent terms changed. Reload and review them again.", consentVersion: SESSION_CONSENT_VERSION }, { status: 409 });
  }

  const deviceId = normalizeDeviceId(parsed.data.deviceId);
  if (!deviceId) return NextResponse.json({ error: "Invalid device." }, { status: 400 });

  const image = parseImageDataUrl(parsed.data.image);
  if (!image) return NextResponse.json({ error: "Unsupported photo. Use a JPEG, PNG or WebP image under 2.5 MB." }, { status: 400 });

  const { supabase, user } = await authenticated();
  if (!user) return NextResponse.json({ error: "Sign in to verify this device." }, { status: 401 });

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Photo storage is not configured." }, { status: 503 });

  const { data: recent } = await supabase
    .from("session_verifications")
    .select("created_at")
    .eq("user_id", user.id)
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent?.created_at && Date.now() - new Date(recent.created_at).getTime() < MIN_SECONDS_BETWEEN_VERIFICATIONS * 1000) {
    return NextResponse.json({ error: "This device was just verified. Please wait a moment." }, { status: 429 });
  }

  const config = getSecurityConfig();
  const context = describeRequest(request);
  const consentedAt = new Date().toISOString();
  const path = `${user.id}/${consentedAt.slice(0, 10)}/${crypto.randomUUID()}.${image.extension}`;

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, image.bytes, {
    contentType: image.mimeType,
    cacheControl: "private, max-age=0",
    upsert: false,
  });
  if (uploadError) {
    console.warn("Verification upload failed", uploadError.message);
    return NextResponse.json({ error: "Could not store the verification photo." }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await admin
    .from("session_verifications")
    .insert({
      user_id: user.id,
      device_id: deviceId,
      consent_version: parsed.data.consentVersion,
      consented_at: consentedAt,
      image_path: path,
      mime_type: image.mimeType,
      ip: context.ip,
      user_agent: context.userAgent,
      country: context.country,
      region: context.region,
      city: context.city,
    })
    .select("id, created_at")
    .single();

  if (insertError || !inserted) {
    await admin.storage.from(BUCKET).remove([path]);
    console.warn("Verification insert failed", insertError?.message);
    return NextResponse.json({ error: "Could not record the verification." }, { status: 500 });
  }

  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  const delivered = await sendSecurityEmail({
    subject: `[Thoughtfully] Session verification photo: ${user.email ?? "unknown account"}`,
    heading: "Session verification photo",
    intro: "The account holder pressed “Verify this device” and consented to this photo being shared with the workspace administrator. This is not a covert capture: the browser asked for camera permission at that moment.",
    rows: [
      { label: "Account", value: user.email ?? user.id },
      { label: "Name", value: (user.user_metadata?.full_name as string | undefined) ?? "Not provided" },
      { label: "Consent version", value: parsed.data.consentVersion },
      { label: "Consented at (UTC)", value: consentedAt },
      { label: "IP address", value: context.ip ?? "Unknown" },
      { label: "Approx. location", value: formatSecurityLocation(context) },
      { label: "Browser", value: context.userAgent?.slice(0, 180) ?? "Unknown" },
      { label: "Device ID", value: deviceId },
      { label: "Retention", value: `${config.retentionDays} days from capture` },
    ],
    photoUrl: signed?.signedUrl ?? null,
    attachment: {
      filename: `verification-${inserted.id}.${image.extension}`,
      content: image.bytes.toString("base64"),
    },
    replyTo: user.email ?? undefined,
  });

  if (delivered) {
    await admin.from("session_verifications").update({ emailed_at: new Date().toISOString() }).eq("id", inserted.id);
  }

  return NextResponse.json({
    ok: true,
    id: inserted.id,
    delivered,
    retentionDays: config.retentionDays,
    createdAt: inserted.created_at,
  });
}

/** Returns only the caller's own consent history (RLS enforces the boundary). */
export async function GET() {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const { supabase, user } = await authenticated();
  if (!user) return NextResponse.json({ error: "Sign in to view your verifications." }, { status: 401 });

  const { data, error } = await supabase
    .from("session_verifications")
    .select("id, device_id, consent_version, consented_at, created_at, emailed_at, city, region, country")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ verifications: data ?? [], retentionDays: getSecurityConfig().retentionDays });
}

/** Deletes the caller's stored photos and rows, keeping privacy promises real. */
export async function DELETE() {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const { user } = await authenticated();
  if (!user) return NextResponse.json({ error: "Sign in to delete your verification history." }, { status: 401 });

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Photo storage is not configured." }, { status: 503 });

  const { data: rows, error: listError } = await admin
    .from("session_verifications")
    .select("id, image_path")
    .eq("user_id", user.id)
    .limit(1000);

  if (listError) return NextResponse.json({ error: listError.message }, { status: 400 });

  const paths = (rows ?? []).map((row) => row.image_path as string).filter(Boolean);
  if (paths.length) {
    for (let index = 0; index < paths.length; index += 100) {
      const { error } = await admin.storage.from(BUCKET).remove(paths.slice(index, index + 100));
      if (error) console.warn("Could not remove verification photos", error.message);
    }
  }

  const { error } = await admin.from("session_verifications").delete().eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, removed: rows?.length ?? 0 });
}
