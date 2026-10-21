import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const reminderSchema = z.object({
  workspaceId: z.string().uuid(),
  event: z.object({
    id: z.string().min(1).max(120),
    title: z.string().trim().min(1).max(300),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    category: z.string().max(80).default("Personal"),
    notes: z.string().max(2000).optional().nullable(),
  }),
});

async function authenticated() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const parsed = reminderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid reminder." }, { status: 400 });

  const { supabase, user } = await authenticated();
  if (!user) return NextResponse.json({ error: "Sign in to use reminders." }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "You are not a member of this workspace." }, { status: 403 });

  const eventAt = new Date(`${parsed.data.event.date}T09:00:00+05:30`);
  const remindAt = new Date(eventAt.getTime() - 24 * 60 * 60 * 1000);
  if (Number.isNaN(remindAt.getTime())) return NextResponse.json({ error: "Invalid event date." }, { status: 400 });
  if (remindAt.getTime() <= Date.now()) {
    return NextResponse.json({ skipped: true, reason: "The one-day-before reminder time has already passed." });
  }

  const { error } = await supabase.from("event_reminders").upsert({
    user_id: user.id,
    workspace_id: parsed.data.workspaceId,
    event_id: parsed.data.event.id,
    title: parsed.data.event.title,
    category: parsed.data.event.category,
    event_date: parsed.data.event.date,
    notes: parsed.data.event.notes ?? null,
    remind_at: remindAt.toISOString(),
    sent_at: null,
  }, { onConflict: "user_id,workspace_id,event_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, remindAt: remindAt.toISOString() });
}

export async function DELETE(request: Request) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");
  const workspaceId = url.searchParams.get("workspaceId");
  if (!eventId || !workspaceId) return NextResponse.json({ error: "Missing eventId or workspaceId." }, { status: 400 });

  const { supabase, user } = await authenticated();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { error } = await supabase.from("event_reminders").delete()
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .eq("event_id", eventId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
