import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import SecurityCheck from "@/components/SecurityCheck";
import { safeNextPath } from "@/lib/auth/redirect";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Verify this device · Thoughtfully AI" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  if (!isSupabaseConfigured) redirect(next);

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const verifyPath = next === "/" ? "/verify" : `/verify?next=${next}`;
    redirect(`/login?next=${encodeURIComponent(verifyPath)}`);
  }

  const session = {
    configured: true,
    user: {
      id: user.id,
      email: user.email ?? "",
      name: (user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? "Planner",
    },
    workspaces: [],
    activeWorkspaceId: null,
  };

  return (
    <main className="security-page">
      <div className="security-sheet security-verify-sheet">
        <div className="security-page-head">
          <span className="security-page-icon"><ShieldCheck size={22} /></span>
          <div>
            <p className="security-eyebrow">THOUGHTFULLY AI · DEVICE CHECK</p>
            <h1>Secure access</h1>
          </div>
        </div>
        <SecurityCheck session={session} mode="page" next={next} />
      </div>
    </main>
  );
}
