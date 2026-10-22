"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Lock, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import "../login/auth.css";

type Status = "checking" | "ready" | "missing";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(isSupabaseConfigured ? "checking" : "missing");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (cancelled) return;
        if (sessionError || !data.session) setStatus("missing");
        else setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("missing");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirmation) {
      setError("The two passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error(updateError.message);
      setNotice("Password updated. Opening your planner…");
      router.replace("/app");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update your password. Please request a new reset link.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-reset-shell">
        <div className="auth-card">
          <Link href="/login" className="auth-back-link"><ArrowLeft size={13} /> Back to sign in</Link>

          <div className="auth-card-heading">
            <h2>Choose a new password</h2>
            <p>This page works only from the reset link we emailed you. After saving, you will be taken straight to your planner.</p>
          </div>

          {status === "checking" && (
            <div className="auth-message success" role="status">Checking your reset link…</div>
          )}

          {status === "missing" && (
            <>
              <div className="auth-message error" role="alert">
                This reset link is missing or has expired. Request a new one from the sign-in page.
              </div>
              <Link href="/login" className="auth-submit"><ArrowRight size={16} /> Request a new link</Link>
            </>
          )}

          {status === "ready" && (
            <form onSubmit={submit}>
              <label className="auth-field" htmlFor="new-password">
                <span>New password</span>
                <div className="auth-input"><Lock size={15} /><input id="new-password" type="password" autoComplete="new-password" autoCapitalize="none" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></div>
              </label>
              <label className="auth-field" htmlFor="confirm-password">
                <span>Confirm new password</span>
                <div className="auth-input"><ShieldCheck size={15} /><input id="confirm-password" type="password" autoComplete="new-password" autoCapitalize="none" required minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Type it once more" /></div>
              </label>

              {error && <div className="auth-message error" role="alert">{error}</div>}
              {notice && <div className="auth-message success" role="status"><Check size={12} /> {notice}</div>}

              <button className="auth-submit" type="submit" disabled={saving}>
                {saving ? <span className="spinner dark" /> : <ArrowRight size={16} />}
                {saving ? "Saving…" : "Save password & open planner"}
              </button>
            </form>
          )}

          <p className="auth-fineprint">
            You can also <Link href="/login" className="auth-inline-link">return to sign in</Link>. Need help? Contact the address in our <Link href="/privacy" className="auth-inline-link">privacy notice</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
