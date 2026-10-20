import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACTIVE_WORKSPACE_COOKIE, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type WorkspaceRow = {
  role: string;
  workspace: { id: string; name: string; slug: string } | Array<{ id: string; name: string; slug: string }> | null;
};

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ configured: false, user: null, workspaces: [], activeWorkspaceId: null });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ configured: true, user: null, workspaces: [], activeWorkspaceId: null }, { status: 401 });
  }

  const { data } = await supabase
    .from("workspace_members")
    .select("role, workspace:workspaces(id,name,slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const workspaces = ((data ?? []) as unknown as WorkspaceRow[]).flatMap((row) => {
    const workspace = Array.isArray(row.workspace) ? row.workspace[0] : row.workspace;
    return workspace ? [{ id: workspace.id, name: workspace.name, slug: workspace.slug, role: row.role }] : [];
  });

  const cookieStore = await cookies();
  const requested = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const activeWorkspaceId = workspaces.some((workspace) => workspace.id === requested)
    ? requested
    : workspaces[0]?.id ?? null;

  const response = NextResponse.json({
    configured: true,
    user: {
      id: user.id,
      email: user.email ?? "",
      name: (user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? "Planner",
    },
    workspaces,
    activeWorkspaceId,
  });

  if (activeWorkspaceId && activeWorkspaceId !== requested) {
    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, activeWorkspaceId, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}
