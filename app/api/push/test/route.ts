import { NextResponse } from "next/server";
import { z } from "zod";
import { configureWebPush, sendPush } from "@/lib/push";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const schema = z.object({ workspaceId: z.string().uuid() });

export async function POST(request: Request) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  if (!configureWebPush()) return NextResponse.json({ error: "Push keys are not configured." }, { status: 503 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid workspace." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id)
    .eq("workspace_id", parsed.data.workspaceId);

  const records = (subscriptions ?? []) as Array<{ endpoint: string; p256dh: string; auth: string }>;
  const results = await Promise.allSettled(records.map((subscription) => sendPush(subscription, {
    title: "Reminders are on",
    body: "Thoughtfully will nudge you one day before your planned occasions.",
    url: "/",
  })));

  return NextResponse.json({
    sent: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  });
}
