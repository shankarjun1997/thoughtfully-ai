import { NextResponse } from "next/server";
import { configureWebPush, sendPush } from "@/lib/push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (secret && authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!configureWebPush()) return NextResponse.json({ error: "Push keys are not configured." }, { status: 503 });

  const supabase = createSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "Supabase admin is not configured." }, { status: 503 });

  const today = new Date().toISOString().slice(0, 10);
  const { data: reminders, error } = await supabase
    .from("event_reminders")
    .select("id, user_id, workspace_id, event_id, title, category, event_date, notes")
    .lte("remind_at", new Date().toISOString())
    .is("sent_at", null)
    .gte("event_date", today)
    .order("remind_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const reminder of reminders ?? []) {
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", reminder.user_id)
      .eq("workspace_id", reminder.workspace_id);

    if (!subscriptions?.length) {
      skipped += 1;
      continue;
    }

    const eventLabel = new Date(`${reminder.event_date}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const payload = {
      title: `Coming up: ${reminder.title}`,
      body: `${eventLabel} · ${reminder.category}. Open Thoughtfully to review your checklist.`,
      url: "/app",
    };

    let delivered = 0;
    for (const subscription of subscriptions) {
      try {
        await sendPush(subscription, payload);
        delivered += 1;
      } catch (caught) {
        failed += 1;
        const statusCode = (caught as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
        }
      }
    }

    if (delivered > 0) {
      sent += delivered;
      await supabase.from("event_reminders").update({ sent_at: new Date().toISOString() }).eq("id", reminder.id);
    }
  }

  return NextResponse.json({ reminders: reminders?.length ?? 0, sent, failed, skipped });
}
