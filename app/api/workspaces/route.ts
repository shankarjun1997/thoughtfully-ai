import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createSchema = z.object({ name: z.string().trim().min(1, "Workspace name is required.").max(120) });

export async function POST(request: Request) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to create a workspace." }, { status: 401 });

  const { data, error } = await supabase.rpc("create_workspace", { p_name: parsed.data.name });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ workspace: data }, { status: 201 });
}
