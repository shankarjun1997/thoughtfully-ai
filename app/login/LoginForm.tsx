"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Database, Lock, Mail, ShieldCheck, User } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { DISMISSED_STORAGE_KEY, VERIFIED_STORAGE_KEY } from "@/lib/security/consent";

type Mode = "signin" | "signup";

function resetSecurityPrompt() {
  try {
    sessionStorage.removeItem(DISMISSED_STORAGE_KEY);
    sessionStorage.removeItem(VERIFIED_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in strict private modes.
  }
}

export default function LoginForm({ configured, next, initialError }: { configured: boolean; next: string; initialError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [error, setError] = useState(initialError ?? "");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  async function sendReset() {
    if (!email.trim()) {
      setError("Enter your email address first, then choose “Forgot password?”.");
      setNotice("");
      return;
    }
    setResetSending(true);
    setError("");
    setNotice("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset`,
      });
      if (resetError) throw new Error(resetError.message);
      setNotice(`If an account exists for ${email.trim()}, we sent a password reset link. Open it on this device to choose a new password.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the reset email. Please try again.");
    } finally {
      setResetSending(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const supabase = createSupabaseBrowserClient();
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw new Error(signInError.message);
        resetSecurityPrompt();
        router.replace(next);
        router.refresh();
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim(), workspace_name: workspaceName.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (signUpError) throw new Error(signUpError.message);

      if (!data.session) {
        setNotice("Check your email to confirm your account. Your workspace will be ready when you sign in.");
        setMode("signin");
        return;
      }

      resetSecurityPrompt();
      router.replace(next);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!configured) {
    return (
      <div className="auth-card">
        <div className="auth-setup-icon"><Database size={22} /></div>
        <h2>Connect Supabase to turn on sign-in</h2>
        <p className="auth-card-intro">
          The multi-tenant login, workspaces and membership rules are built and waiting. Add these environment variables on Vercel, then run the tenant migration.
        </p>
        <ul className="auth-setup-list">
          <li><code>NEXT_PUBLIC_SUPABASE_URL</code></li>
          <li><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>
          <li><code>SUPABASE_SERVICE_ROLE_KEY</code> <span>optional, for admin jobs</span></li>
        </ul>
        <p className="auth-setup-note">
          Apply <code>supabase/migrations/202610190001_multi_tenant.sql</code> in the Supabase SQL editor after the initial schema.
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <div className="auth-tabs" role="tablist" aria-label="Account access">
        <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "selected" : ""} onClick={() => switchMode("signin")}>Sign in</button>
        <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "selected" : ""} onClick={() => switchMode("signup")}>Create workspace</button>
      </div>

      <div className="auth-card-heading">
        <h2>{mode === "signin" ? "Welcome back" : "Start a thoughtful workspace"}</h2>
        <p>{mode === "signin" ? "Sign in to your planning workspace and pick up where you left off." : "One account, your own private space. You can add more workspaces later."}</p>
      </div>

      <form onSubmit={submit}>
        {mode === "signup" && (
          <>
            <label className="auth-field" htmlFor="fullName">
              <span>Your name</span>
              <div className="auth-input"><User size={15} /><input id="fullName" autoComplete="name" enterKeyHint="next" required maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="e.g. Ananya Rao" /></div>
            </label>
            <label className="auth-field" htmlFor="workspaceName">
              <span>Workspace name</span>
              <div className="auth-input"><Building2 size={15} /><input id="workspaceName" enterKeyHint="next" required maxLength={120} value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Our family plans" /></div>
            </label>
          </>
        )}

        <label className="auth-field" htmlFor="email">
          <span>Email address</span>
          <div className="auth-input"><Mail size={15} /><input id="email" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div>
        </label>

        <label className="auth-field" htmlFor="password">
          <span>Password</span>
          <div className="auth-input"><Lock size={15} /><input id="password" type="password" autoCapitalize="none" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "signin" ? "Your password" : "At least 8 characters"} /></div>
        </label>

        {mode === "signin" && (
          <div className="auth-forgot-row">
            <button type="button" className="auth-text-button" disabled={resetSending || loading} onClick={sendReset}>
              {resetSending ? "Sending reset link…" : "Forgot password?"}
            </button>
            <Link href="/reset" className="auth-text-button">Have a reset link?</Link>
          </div>
        )}

        {error && <div className="auth-message error" role="alert">{error}</div>}
        {notice && <div className="auth-message success" role="status">{notice}</div>}

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? <span className="spinner dark" /> : mode === "signin" ? <ArrowRight size={16} /> : <ShieldCheck size={16} />}
          {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="auth-fineprint">
        {mode === "signin" ? "Each workspace keeps its lists and plans separate. Only invited members can see them." : "Every new account gets its own owner workspace automatically. Add more from the sidebar."}
      </p>
    </div>
  );
}
