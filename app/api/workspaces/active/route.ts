import { NextResponse } from "next/server";
import { z } from "zod";
import { ACTIVE_WORKSPACE_COOKIE, isSupabaseConfigured } from "@/lib/supabase/config";
import { requireVerifiedRequest } from "@/lib/security/api-gate";

const switchSchema = z.object({ workspaceId: z.string().uuid() });

export async function POST(request: Request) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const parsed = switchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid workspace." }, { status: 400 });

  const gate = await requireVerifiedRequest({ unauthenticatedMessage: "Not authenticated." });
  if (!gate.ok) return gate.response;
  if (!gate.user || !gate.supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { supabase, user } = gate;

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return NextResponse.json({ error: "You are not a member of this workspace." }, { status: 403 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACTIVE_WORKSPACE_COOKIE, parsed.data.workspaceId, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
