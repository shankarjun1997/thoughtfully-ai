import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import DeleteVerificationsButton from "@/components/DeleteVerificationsButton";
import { sessionConsentPoints } from "@/lib/security/consent";
import { getSecurityConfig } from "@/lib/security/config";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Security · Thoughtfully AI" };

type VerificationRow = {
  id: string;
  consent_version: string;
  consented_at: string;
  created_at: string;
  emailed_at: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
};

function formatWhen(value: string) {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default async function SecurityPage() {
  if (!isSupabaseConfigured) {
    return (
      <main className="security-page">
        <div className="security-sheet">
          <Link href="/" className="security-back"><ArrowLeft size={14} /> Back to planner</Link>
          <h1>Security</h1>
          <p className="security-page-intro">Local mode is active, so no account, device or photo data is collected.</p>
        </div>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/security");

  const { data } = await supabase
    .from("session_verifications")
    .select("id, consent_version, consented_at, created_at, emailed_at, city, region, country")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(25);

  const rows = (data ?? []) as VerificationRow[];
  const config = getSecurityConfig();

  return (
    <main className="security-page">
      <div className="security-sheet">
        <Link href="/" className="security-back"><ArrowLeft size={14} /> Back to planner</Link>

        <div className="security-page-head">
          <span className="security-page-icon"><ShieldCheck size={22} /></span>
          <div>
            <p className="security-eyebrow">CONSENT & PRIVACY</p>
            <h1>Security</h1>
          </div>
        </div>

        <p className="security-page-intro">
          {config.required
            ? "Session verification is required to use this workspace. A photo is captured only after you press “Turn on camera” and agree to share it with the workspace administrator. You may sign out instead."
            : "Session checks are optional. A photo is captured only after you press “Turn on camera” and agree to share it with the workspace administrator."}
          {" "}Photos are kept privately for {config.retentionDays} days and then deleted automatically.
        </p>

        <ul className="security-points">
          {sessionConsentPoints(config.required).map((point) => <li key={point}>{point}</li>)}
        </ul>

        {config.required && config.alertEmail && (
          <p className="security-page-note">
            Cannot use a camera? Sign out and email <a href={`mailto:${config.alertEmail}`}>{config.alertEmail}</a> to ask the administrator for an alternative verification check.
          </p>
        )}

        <div className="security-history">
          <div className="security-history-head">
            <h2>Your verification history</h2>
            <DeleteVerificationsButton count={rows.length} />
          </div>

          {rows.length ? (
            <ul>
              {rows.map((row) => (
                <li key={row.id}>
                  <div>
                    <strong>{formatWhen(row.consented_at)}</strong>
                    <span>{[row.city, row.region, row.country].filter(Boolean).join(", ") || "Unknown location"}</span>
                  </div>
                  <div className="security-history-meta">
                    <span>Consent {row.consent_version}</span>
                    <span>{row.emailed_at ? "Sent to administrator" : "Not emailed"}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="security-empty">No session verifications yet. You can skip the prompt whenever it appears.</p>
          )}
        </div>

        <p className="security-page-note">
          Signed in as <strong>{user.email}</strong>. To close this device session, use Sign out in the planner sidebar.
        </p>
      </div>
    </main>
  );
}
