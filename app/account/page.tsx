import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Flower2, LogOut, ShieldCheck, UserRound } from "lucide-react";
import AccountActions from "@/components/AccountActions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "./account.css";

export const metadata: Metadata = { title: "Account · Thoughtfully AI" };

export default async function AccountPage() {
  if (!isSupabaseConfigured) redirect("/login?next=/account");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const email = user.email ?? "";
  const name = (user.user_metadata?.full_name as string | undefined)?.trim() || email.split("@")[0] || "Planner";
  const initial = name.trim().charAt(0).toUpperCase() || "P";

  return (
    <main className="account-page">
      <header className="account-header">
        <Link href="/app" className="account-logo" aria-label="Thoughtfully planner">
          <span className="account-logo-mark"><Flower2 size={17} /></span>
          <span>thoughtfully<span className="account-logo-badge">AI</span></span>
        </Link>
        <div className="account-header-actions">
          <Link href="/security" className="account-header-link"><ShieldCheck size={14} /> Security</Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="account-header-link"><LogOut size={14} /> Sign out</button>
          </form>
        </div>
      </header>

      <div className="account-shell">
        <Link href="/app" className="account-back"><ArrowLeft size={13} /> Back to planner</Link>

        <div className="account-title">
          <span className="account-avatar">{initial}</span>
          <div>
            <p className="account-eyebrow">YOUR ACCOUNT</p>
            <h1>{name}</h1>
            <p>{email}</p>
          </div>
        </div>

        <section className="account-card">
          <div className="account-card-head">
            <span className="account-card-icon"><UserRound size={18} /></span>
            <div>
              <h2>Profile</h2>
              <p>This is the email address used to sign in. Your name comes from your account profile.</p>
            </div>
          </div>
          <dl className="account-details">
            <div><dt>Email</dt><dd>{email}</dd></div>
            <div><dt>Name</dt><dd>{name}</dd></div>
            <div><dt>Account ID</dt><dd className="account-mono">{user.id}</dd></div>
          </dl>
        </section>

        <section className="account-card">
          <div className="account-card-head">
            <span className="account-card-icon"><ShieldCheck size={18} /></span>
            <div>
              <h2>Privacy &amp; security</h2>
              <p>Review your consent-based device verification history, or delete the photos stored for this account.</p>
            </div>
          </div>
          <Link href="/security" className="account-button quiet">Open security settings <ShieldCheck size={15} /></Link>
        </section>

        <AccountActions email={email} />

        <p className="account-fineprint">
          Read the <Link href="/privacy">privacy notice</Link> and <Link href="/terms">terms</Link> for how account,
          verification and billing data are handled.
        </p>
      </div>
    </main>
  );
}
