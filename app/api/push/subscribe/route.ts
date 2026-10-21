import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const subscriptionSchema = z.object({
  workspaceId: z.string().uuid(),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  }),
});

const deleteSchema = z.object({ endpoint: z.string().url() });

async function authenticated() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });

  const { supabase, user } = await authenticated();
  if (!user) return NextResponse.json({ error: "Sign in to enable reminders." }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "You are not a member of this workspace." }, { status: 403 });

  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    workspace_id: parsed.data.workspaceId,
    endpoint: parsed.data.subscription.endpoint,
    p256dh: parsed.data.subscription.keys.p256dh,
    auth: parsed.data.subscription.keys.auth,
    user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });

  const { supabase, user } = await authenticated();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
