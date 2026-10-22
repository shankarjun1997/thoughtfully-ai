import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSecurityConfig } from "@/lib/security/config";
import { sessionConsentPoints, SESSION_CONSENT_VERSION } from "@/lib/security/consent";
import { sendSecurityEmail } from "@/lib/security/email";
import { describeRequest, formatSecurityLocation, normalizeDeviceId } from "@/lib/security/request";
import { isVerificationTokenValid, VERIFICATION_COOKIE } from "@/lib/security/session-cookie";

export const runtime = "nodejs";

const bodySchema = z.object({
  deviceId: z.string().min(8).max(128),
  timezone: z.string().max(80).optional(),
});

function summarizeDevice(userAgent: string | null) {
  if (!userAgent) return "Unknown browser";
  return userAgent.slice(0, 180);
}

/**
 * Records the current browser as a login device. A brand-new device triggers a
 * plain-text security alert to the administrator (no photo is involved here).
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ configured: false, verification: { enabled: false, due: false } });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid device." }, { status: 400 });
  const deviceId = normalizeDeviceId(parsed.data.deviceId);
  if (!deviceId) return NextResponse.json({ error: "Invalid device." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const config = getSecurityConfig();
  const context = describeRequest(request);
  const location = formatSecurityLocation(context);
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("login_devices")
    .select("id, alert_sent_at, first_seen_at")
    .eq("user_id", user.id)
    .eq("device_id", deviceId)
    .maybeSingle();

  const isNewDevice = !existing;

  if (existing) {
    await supabase
      .from("login_devices")
      .update({
        last_seen_at: now,
        user_agent: context.userAgent,
        ip: context.ip,
        country: context.country,
        region: context.region,
        city: context.city,
      })
      .eq("id", existing.id);
  } else {
    const { error: insertError } = await supabase.from("login_devices").insert({
      user_id: user.id,
      device_id: deviceId,
      user_agent: context.userAgent,
      ip: context.ip,
      country: context.country,
      region: context.region,
      city: context.city,
      first_seen_at: now,
      last_seen_at: now,
    });
    if (insertError) {
      console.warn("Could not record login device", insertError.message);
    }
  }

  let alertDelivered = false;
  if (isNewDevice) {
    alertDelivered = await sendSecurityEmail({
      subject: `[Thoughtfully] New device sign-in: ${user.email ?? "unknown account"}`,
      heading: "New device signed in",
      intro: "A browser this account has not used before just signed in. Review the details below. If this was not the account owner, revoke the session in Supabase Auth and ask the user to reset their password.",
      rows: [
        { label: "Account", value: user.email ?? user.id },
        { label: "Name", value: (user.user_metadata?.full_name as string | undefined) ?? "Not provided" },
        { label: "IP address", value: context.ip ?? "Unknown" },
        { label: "Approx. location", value: location },
        { label: "Browser", value: summarizeDevice(context.userAgent) },
        { label: "Device ID", value: deviceId },
        { label: "Time (UTC)", value: now },
      ],
      replyTo: user.email ?? undefined,
    });
    if (alertDelivered) {
      await supabase.from("login_devices").update({ alert_sent_at: now }).eq("user_id", user.id).eq("device_id", deviceId);
    }
  }

  const { data: latest } = await supabase
    .from("session_verifications")
    .select("created_at")
    .eq("user_id", user.id)
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const admin = createSupabaseAdminClient();
  const deliverable = Boolean(admin && config.resendApiKey && config.alertEmail);
  const enabled = config.verificationEnabled && deliverable;
  const lastVerifiedAt = (latest?.created_at as string | undefined) ?? null;
  const verificationFresh = lastVerifiedAt
    ? Date.now() - new Date(lastVerifiedAt).getTime() < config.validHours * 60 * 60 * 1000
    : false;

  const cookieStore = await cookies();
  const gateSatisfied = await isVerificationTokenValid(cookieStore.get(VERIFICATION_COOKIE)?.value, user.id);

  return NextResponse.json({
    configured: true,
    isNewDevice,
    alertDelivered,
    gateSatisfied,
    verification: {
      enabled,
      required: enabled && config.required,
      due: enabled && !verificationFresh,
      consentVersion: SESSION_CONSENT_VERSION,
      consentPoints: sessionConsentPoints(config.required),
      retentionDays: config.retentionDays,
      validHours: config.validHours,
      lastVerifiedAt,
    },
  });
}
