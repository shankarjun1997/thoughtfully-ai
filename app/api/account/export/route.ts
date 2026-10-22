import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MembershipRow = {
  role: string;
  created_at: string;
  workspace: { id: string; name: string; slug: string; owner_id: string } | Array<{ id: string; name: string; slug: string; owner_id: string }> | null;
};

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to export your data." }, { status: 401 });

  const [membershipResult, verificationResult, deviceResult] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("role, created_at, workspace:workspaces(id,name,slug,owner_id)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("session_verifications")
      .select("id, device_id, consent_version, consented_at, created_at, emailed_at, ip, user_agent, country, region, city")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("login_devices")
      .select("id, device_id, user_agent, ip, country, region, city, first_seen_at, last_seen_at, alert_sent_at")
      .eq("user_id", user.id)
      .order("first_seen_at", { ascending: false })
      .limit(1000),
  ]);

  const memberships = ((membershipResult.data ?? []) as unknown as MembershipRow[]).flatMap((row) => {
    const workspace = Array.isArray(row.workspace) ? row.workspace[0] : row.workspace;
    return workspace
      ? [{ role: row.role, joined_at: row.created_at, workspace }]
      : [];
  });

  // The subscriptions table is owned by the billing workstream. If it is not
  // present yet the query fails and we simply omit the section.
  let subscription: unknown = null;
  const admin = createSupabaseAdminClient();
  const billingClient = admin ?? supabase;
  const { data: subscriptionRow, error: subscriptionError } = await billingClient
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!subscriptionError && subscriptionRow) subscription = subscriptionRow;

  const profile = {
    id: user.id,
    email: user.email ?? null,
    name: (user.user_metadata?.full_name as string | undefined) ?? null,
    created_at: user.created_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
  };

  const payload = {
    exported_at: new Date().toISOString(),
    profile,
    workspaces: memberships.map((membership) => membership.workspace),
    memberships,
    subscription,
    verification_metadata: verificationResult.data ?? [],
    login_devices: deviceResult.data ?? [],
    notices: [
      "Verification photos and signed image links are intentionally excluded from this export.",
      "Shopping lists and occasions saved in browser storage are not accessible to the server.",
    ],
  };

  const filename = `thoughtfully-account-${new Date().toISOString().slice(0, 10)}.json`;
  return NextResponse.json(payload, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
