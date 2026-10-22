import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Flower2, ShieldCheck, Users } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeNextPath } from "@/lib/auth/redirect";
import LoginForm from "./LoginForm";
import "./auth.css";

export const metadata: Metadata = { title: "Sign in · Thoughtfully AI" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-brand">
          <Link href="/" className="auth-logo">
            <span className="auth-logo-mark"><Flower2 size={20} /></span>
            <span className="auth-logo-text">thoughtfully<span>AI</span></span>
          </Link>

          <div className="auth-brand-copy">
            <div className="auth-eyebrow"><span /> MULTI-TENANT PLANNING</div>
            <h1>Every workspace, <em>its own thoughtful space.</em></h1>
            <p>Plan poojas, parties and everyday errands together — while each family, team or client keeps its lists completely separate.</p>
            <ul className="auth-benefits">
              <li><span className="auth-benefit-icon"><Users size={15} /></span><div><strong>Private by workspace</strong><small>Lists, events and budgets are scoped to the workspace you are in.</small></div></li>
              <li><span className="auth-benefit-icon"><ShieldCheck size={15} /></span><div><strong>Membership-based access</strong><small>Row-level security means only workspace members can read or change data.</small></div></li>
              <li><span className="auth-benefit-icon"><Check size={15} /></span><div><strong>Switch without mixing</strong><small>Move between workspaces from the sidebar without leaking a single item.</small></div></li>
            </ul>
          </div>

          <p className="auth-quote">&ldquo;Thoughtful doesn&apos;t mean expensive.&rdquo;</p>
        </section>

        <section className="auth-panel">
          <LoginForm configured={isSupabaseConfigured} next={next} initialError={params.error} />
          {!isSupabaseConfigured && (
            <Link href="/app" className="auth-local-link">Continue in local mode <ArrowRight size={14} /></Link>
          )}
          <p className="auth-legal">By continuing you agree to keep workspace invitations limited to people you trust.</p>
        </section>
      </div>
    </main>
  );
}
