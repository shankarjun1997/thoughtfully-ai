import { DEFAULT_RETENTION_DAYS, VERIFICATION_VALID_HOURS } from "./consent";

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getSecurityConfig() {
  const retentionDays = Math.min(positiveInt(process.env.SESSION_VERIFICATION_RETENTION_DAYS, DEFAULT_RETENTION_DAYS), 365);
  return {
    verificationEnabled: process.env.SESSION_VERIFICATION_ENABLED !== "false",
    required: process.env.SESSION_VERIFICATION_REQUIRED === "true",
    retentionDays,
    validHours: VERIFICATION_VALID_HOURS,
    alertEmail: process.env.SECURITY_ALERT_EMAIL?.trim() || "",
    alertFrom: process.env.SECURITY_ALERT_FROM?.trim() || "Thoughtfully AI <onboarding@resend.dev>",
    resendApiKey: process.env.RESEND_API_KEY?.trim() || "",
    notifyUser: process.env.SECURITY_NOTIFY_USER === "true",
    sessionSecret: process.env.SECURITY_SESSION_SECRET
      || process.env.SUPABASE_SECRET_KEY
      || process.env.SUPABASE_SERVICE_ROLE_KEY
      || "",
  };
}
