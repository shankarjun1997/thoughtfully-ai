import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check, Flower2, ShieldCheck, Sparkles } from "lucide-react";
import { getBillingState } from "@/lib/billing/state";
import { safeNextPath } from "@/lib/auth/redirect";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SubscribeClient from "./SubscribeClient";
import "./billing.css";

export const metadata: Metadata = { title: "Subscribe · Thoughtfully AI" };

export default async function SubscribePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next, "/app");

  if (!isSupabaseConfigured) {
    return (
      <main className="billing-page">
        <div className="billing-shell">
          <header className="billing-topbar">
            <Link href="/" className="billing-logo">
              <span className="billing-logo-mark"><Flower2 size={19} /></span>
              <span className="billing-logo-text">thoughtfully<span>AI</span></span>
            </Link>
          </header>

          <section className="billing-single-card">
            <span className="billing-badge open">OPEN ACCESS</span>
            <h1>Payments are not configured yet.</h1>
            <p>Your workspace stays fully available. Billing will switch on once Razorpay keys are added to the deployment.</p>
            <Link href={next} className="billing-btn primary">Continue to app <ArrowRight size={14} /></Link>
          </section>
        </div>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/subscribe");

  const state = await getBillingState(supabase, user);
  const paidActive = state.status === "active" && state.active;

  return (
    <main className="billing-page">
      <div className="billing-shell">
        <header className="billing-topbar">
          <Link href="/" className="billing-logo">
            <span className="billing-logo-mark"><Flower2 size={19} /></span>
            <span className="billing-logo-text">thoughtfully<span>AI</span></span>
          </Link>
          <span className="billing-secure-chip"><ShieldCheck size={13} /> Secure billing</span>
        </header>

        <div className="billing-grid">
          <section className="billing-plan">
            <div className="billing-eyebrow"><span /> THOUGHTFULLY AI · ANNUAL</div>
            <h1>One thoughtful year of <em>calmer planning.</em></h1>
            <p className="billing-lede">
              Start with all features free for 7 days. Keep them for a full year with a single ₹200 payment —
              no subscription traps, no auto-renewal.
            </p>

            <div className="billing-price">
              <span className="billing-currency">₹</span>
              <strong>200</strong>
              <span className="billing-period">/ year</span>
            </div>
            <p className="billing-price-note"><Sparkles size={13} /> 7-day free trial included · One-time payment</p>

            <ul className="billing-features">
              <li><span><Check size={12} /></span><div><strong>Unlimited plans &amp; lists</strong><small>Occasions, shopping, budgets and everyday errands.</small></div></li>
              <li><span><Check size={12} /></span><div><strong>AI planning companions</strong><small>Turn a link, photo or idea into a ready-to-use plan.</small></div></li>
              <li><span><Check size={12} /></span><div><strong>Reminders that reach you</strong><small>Push notifications for the things that matter.</small></div></li>
              <li><span><Check size={12} /></span><div><strong>Private workspaces</strong><small>Keep family, team and client planning separate.</small></div></li>
            </ul>
          </section>

          <section className="billing-status-card">
            <SubscribeClient
              configured={state.configured}
              status={state.status}
              active={state.active}
              paidActive={paidActive}
              daysLeft={state.daysLeft}
              trialEndsAt={state.trialEndsAt}
              currentPeriodEnd={state.currentPeriodEnd}
              next={next}
            />
          </section>
        </div>

        <p className="billing-footnote">Payments are processed securely by Razorpay. We never store your card or UPI details.</p>
      </div>
    </main>
  );
}
