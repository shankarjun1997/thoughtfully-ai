import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isVerificationTokenValid, VERIFICATION_COOKIE } from "@/lib/security/session-cookie";

export type VerifiedRequestSuccess = {
  ok: true;
  user: User | null;
  supabase: SupabaseClient | null;
};

export type VerifiedRequestFailure = {
  ok: false;
  response: NextResponse;
};

export type VerifiedRequest = VerifiedRequestSuccess | VerifiedRequestFailure;

type GateOptions = {
  unauthenticatedMessage?: string;
};

/**
 * Mirrors the middleware gate so API routes cannot be reached before a
 * required device verification, even though middleware skips /api.
 */
export function verificationGateRequired() {
  return process.env.SESSION_VERIFICATION_REQUIRED === "true"
    && process.env.SESSION_VERIFICATION_ENABLED !== "false"
    && Boolean(
      process.env.RESEND_API_KEY
      && process.env.SECURITY_ALERT_EMAIL
      && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
    );
}

export async function requireVerifiedRequest(options: GateOptions = {}): Promise<VerifiedRequest> {
  if (!isSupabaseConfigured) return { ok: true, user: null, supabase: null };

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: options.unauthenticatedMessage ?? "Sign in to continue." },
        { status: 401 },
      ),
    };
  }

  if (verificationGateRequired()) {
    const cookieStore = await cookies();
    const verified = await isVerificationTokenValid(cookieStore.get(VERIFICATION_COOKIE)?.value, user.id);
    if (!verified) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Verify this device to continue." }, { status: 403 }),
      };
    }
  }

  return { ok: true, user, supabase };
}
