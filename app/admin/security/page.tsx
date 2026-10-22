import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Camera, KeyRound, ShieldAlert, ShieldCheck, UserCheck } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import AdminDeleteVerification from "@/components/AdminDeleteVerification";
import { isSecurityAdmin } from "@/lib/security/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import "./security.css";

export const metadata: Metadata = { title: "Security dashboard · Thoughtfully AI" };

const BUCKET = "session-verifications";
const PHOTO_URL_SECONDS = 60 * 60;

type VerificationRow = {
  id: string;
  user_id: string;
  consent_version: string;
  consented_at: string;
  created_at: string;
  emailed_at: string | null;
  liveness_method?: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  ip: string | null;
  user_agent: string | null;
  image_path: string | null;
};

type DeviceRow = {
  id: string;
  user_id: string;
  device_id: string;
  ip: string | null;
  city: string | null;
  country: string | null;
  first_seen_at: string;
  last_seen_at: string;
  alert_sent_at: string | null;
};

function formatWhen(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function location(row: { city: string | null; region?: string | null; country: string | null }) {
  return [row.city, row.region, row.country].filter(Boolean).join(", ") || "Unknown location";
}

function shortId(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

async function distinctVerifiedUsers(admin: SupabaseClient, total: number) {
  const ids = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; from < total && from < 50_000; from += pageSize) {
    const { data, error } = await admin
      .from("session_verifications")
      .select("user_id")
      .range(from, from + pageSize - 1);
    if (error) break;
    for (const row of (data ?? []) as Array<{ user_id: string }>) ids.add(row.user_id);
    if (!data || data.length < pageSize) break;
  }
  return ids.size;
}

function AccessDenied({ signedInAs }: { signedInAs?: string }) {
  return (
    <main className="admin-security-page">
      <section className="admin-security-sheet admin-security-denied">
        <span className="admin-security-denied-icon"><ShieldAlert size={24} /></span>
        <p className="admin-security-eyebrow">RESTRICTED AREA</p>
        <h1>Security dashboard</h1>
        <p>
          This page is available only to the configured security administrator.
          {signedInAs ? ` You are signed in as ${signedInAs}.` : ""}
        </p>
        <Link href="/app" className="admin-security-back"><ArrowLeft size={14} /> Back to planner</Link>
      </section>
    </main>
  );
}

export default async function AdminSecurityPage() {
  if (!isSupabaseConfigured) {
    return (
      <main className="admin-security-page">
        <section className="admin-security-sheet admin-security-denied">
          <span className="admin-security-denied-icon"><ShieldAlert size={24} /></span>
          <p className="admin-security-eyebrow">SECURITY DASHBOARD</p>
          <h1>Not available</h1>
          <p>Supabase is not configured, so there is no account or verification data to review.</p>
          <Link href="/app" className="admin-security-back"><ArrowLeft size={14} /> Back to planner</Link>
        </section>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/security");
  if (!isSecurityAdmin(user.email)) return <AccessDenied signedInAs={user.email ?? user.id} />;

  const admin = createSupabaseAdminClient();
  if (!admin) return <AccessDenied signedInAs={user.email ?? user.id} />;

  const [verificationsResult, devicesResult, verificationCountResult, deviceCountResult] = await Promise.all([
    admin
      .from("session_verifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("login_devices")
      .select("id, user_id, device_id, ip, city, country, first_seen_at, last_seen_at, alert_sent_at")
      .order("last_seen_at", { ascending: false })
      .limit(50),
    admin.from("session_verifications").select("id", { count: "exact", head: true }),
    admin.from("login_devices").select("id", { count: "exact", head: true }),
  ]);

  const verificationCount = verificationCountResult.count ?? 0;
  const verifications = (verificationsResult.data ?? []) as VerificationRow[];
  const devices = (devicesResult.data ?? []) as DeviceRow[];
  const verifiedUserCount = await distinctVerifiedUsers(admin, verificationCount);

  const { data: userList, error: userListError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map<string, string>();
  for (const account of userList?.users ?? []) {
    if (account.id) emailById.set(account.id, account.email ?? account.id);
  }
  const emailFor = (id: string) => emailById.get(id) ?? shortId(id);

  const signedPhotos = new Map<string, string>();
  await Promise.all(verifications.map(async (row) => {
    if (!row.image_path) return;
    const { data } = await admin.storage.from(BUCKET).createSignedUrl(row.image_path, PHOTO_URL_SECONDS);
    if (data?.signedUrl) signedPhotos.set(row.id, data.signedUrl);
  }));

  return (
    <main className="admin-security-page">
      <div className="admin-security-sheet">
        <div className="admin-security-top">
          <Link href="/app" className="admin-security-back"><ArrowLeft size={14} /> Back to planner</Link>
          <Link href="/security" className="admin-security-back">My security</Link>
        </div>

        <header className="admin-security-head">
          <span className="admin-security-icon"><ShieldCheck size={22} /></span>
          <div>
            <p className="admin-security-eyebrow">ADMIN · CONSENT & SAFETY</p>
            <h1>Security dashboard</h1>
            <p className="admin-security-intro">
              Signed in as <strong>{user.email}</strong>. Review consent-based device verifications and recent sign-in devices.
              Photos are private and are shown through short-lived signed links (1 hour). Deletion is permanent and removes both the record and its stored photo.
            </p>
          </div>
        </header>

        <section className="admin-security-stats" aria-label="Security totals">
          <article className="admin-security-stat">
            <span className="admin-security-stat-icon sage"><Camera size={17} /></span>
            <div><strong>{verificationCount}</strong><span>Verification photos</span></div>
          </article>
          <article className="admin-security-stat">
            <span className="admin-security-stat-icon blue"><UserCheck size={17} /></span>
            <div><strong>{verifiedUserCount}</strong><span>Distinct verified users</span></div>
          </article>
          <article className="admin-security-stat">
            <span className="admin-security-stat-icon peach"><KeyRound size={17} /></span>
            <div><strong>{deviceCountResult.count ?? devices.length}</strong><span>Login devices</span></div>
          </article>
        </section>

        <section className="admin-security-section" aria-labelledby="verifications-heading">
          <div className="admin-security-section-head">
            <h2 id="verifications-heading">Latest verifications</h2>
            <span>Last 50 · newest first</span>
          </div>

          {verifications.length ? (
            <div className="admin-security-cards">
              {verifications.map((row) => {
                const photoUrl = signedPhotos.get(row.id);
                return (
                  <article className="admin-verification-card" key={row.id}>
                    <div className="admin-verification-photo">
                      {photoUrl ? (
                        <a href={photoUrl} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photoUrl} alt={`Verification photo for ${emailFor(row.user_id)}`} loading="lazy" />
                        </a>
                      ) : (
                        <span>Photo unavailable</span>
                      )}
                    </div>
                    <div className="admin-verification-body">
                      <div className="admin-verification-title">
                        <strong>{emailFor(row.user_id)}</strong>
                        <span>{formatWhen(row.consented_at)}</span>
                      </div>
                      <dl className="admin-verification-meta">
                        <div><dt>Location</dt><dd>{location(row)}</dd></div>
                        <div><dt>IP</dt><dd>{row.ip ?? "Unknown"}</dd></div>
                        <div><dt>Consent</dt><dd>{row.consent_version}</dd></div>
                        {row.liveness_method ? <div><dt>Liveness</dt><dd>{row.liveness_method}</dd></div> : null}
                        <div><dt>Emailed</dt><dd>{row.emailed_at ? formatWhen(row.emailed_at) : "Not delivered"}</dd></div>
                        <div><dt>Browser</dt><dd title={row.user_agent ?? undefined}>{row.user_agent ?? "Unknown"}</dd></div>
                      </dl>
                      <AdminDeleteVerification id={row.id} />
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="admin-security-empty">No session verifications have been recorded yet.</p>
          )}
        </section>

        <section className="admin-security-section" aria-labelledby="devices-heading">
          <div className="admin-security-section-head">
            <h2 id="devices-heading">Recent login devices</h2>
            <span>Last 50 · newest first</span>
          </div>

          {devices.length ? (
            <div className="admin-device-table-wrap">
              <table className="admin-device-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Device</th>
                    <th>Network</th>
                    <th>First seen</th>
                    <th>Last seen</th>
                    <th>Alert</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device.id}>
                      <td>{emailFor(device.user_id)}</td>
                      <td><code title={device.device_id}>{shortId(device.device_id)}</code></td>
                      <td>
                        <span>{location(device)}</span>
                        <small>{device.ip ?? "Unknown IP"}</small>
                      </td>
                      <td>{formatWhen(device.first_seen_at)}</td>
                      <td>{formatWhen(device.last_seen_at)}</td>
                      <td>{device.alert_sent_at ? formatWhen(device.alert_sent_at) : "Not sent"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="admin-security-empty">No login devices have been recorded yet.</p>
          )}
        </section>

        <p className="admin-security-note">
          {userListError
            ? "Some account emails could not be loaded, so user ids are shown instead."
            : "Emails are loaded from the first 1,000 accounts; older accounts may appear as user ids."}
          {" "}Verification photos are private and never public. Deleting a verification is permanent.
        </p>
      </div>
    </main>
  );
}
