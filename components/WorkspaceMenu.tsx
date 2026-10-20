"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, LogIn, LogOut, Plus, X } from "lucide-react";

export type Workspace = { id: string; name: string; slug: string; role: string };
export type SessionData = {
  configured: boolean;
  user: { id: string; email: string; name: string } | null;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
};

export default function WorkspaceMenu({ session }: { session: SessionData | null }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!session) return null;

  if (!session.configured) {
    return (
      <div className="profile workspace-menu">
        <div className="avatar">L</div>
        <div className="profile-text"><strong>Local mode</strong><span>Saved on this device</span></div>
        <Link className="workspace-icon-link" href="/login" aria-label="Sign in"><LogIn size={16} /></Link>
      </div>
    );
  }

  const user = session.user;
  const active = session.workspaces.find((workspace) => workspace.id === session.activeWorkspaceId) ?? session.workspaces[0];
  const initial = (user?.name || user?.email || "P").trim().charAt(0).toUpperCase();

  async function switchWorkspace(workspaceId: string) {
    if (!workspaceId || workspaceId === session?.activeWorkspaceId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/workspaces/active", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not switch workspace.");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not switch workspace.");
      setBusy(false);
    }
  }

  async function createWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not create workspace.");
      const workspaceId = body.workspace?.id as string | undefined;
      if (workspaceId) await fetch("/api/workspaces/active", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId }) });
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create workspace.");
      setBusy(false);
    }
  }

  return (
    <div className="workspace-menu">
      <div className="workspace-menu-head">
        <div className="avatar">{initial}</div>
        <div className="profile-text">
          <strong>{active?.name ?? "Your workspace"}</strong>
          <span>{user?.email}</span>
        </div>
        <button className="workspace-icon-link" onClick={() => setCreating((value) => !value)} aria-label="New workspace" title="New workspace">
          {creating ? <X size={16} /> : <Plus size={16} />}
        </button>
      </div>

      {session.workspaces.length > 1 && (
        <label className="workspace-switch">
          <span>Workspace</span>
          <select value={active?.id ?? ""} disabled={busy} onChange={(event) => switchWorkspace(event.target.value)}>
            {session.workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>{workspace.name}{workspace.role !== "owner" ? ` · ${workspace.role}` : ""}</option>
            ))}
          </select>
        </label>
      )}

      {creating && (
        <form className="workspace-new" onSubmit={createWorkspace}>
          <input autoFocus className="text-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="New workspace name" maxLength={120} />
          <div className="workspace-new-actions">
            <button type="submit" className="secondary-button" disabled={busy || !name.trim()}><Check size={14} /> Create</button>
            <button type="button" className="text-action" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </form>
      )}

      {error && <p className="workspace-error">{error}</p>}

      <form action="/auth/signout" method="post" className="workspace-signout">
        <button type="submit"><LogOut size={14} /> Sign out</button>
      </form>
    </div>
  );
}
