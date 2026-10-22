"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function AdminDeleteVerification({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!window.confirm("Delete this verification photo and record? This cannot be undone.")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/security?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not delete this verification.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete this verification.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-delete-verification">
      <button type="button" onClick={remove} disabled={busy}>
        <Trash2 size={13} /> {busy ? "Deleting…" : "Delete verification"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
