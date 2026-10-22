"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteVerificationsButton({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!window.confirm("Delete all stored verification photos and their records? This cannot be undone.")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/security/verification", { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not delete verification history.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete verification history.");
    } finally {
      setBusy(false);
    }
  }

  if (!count) return null;

  return (
    <div className="security-delete">
      <button type="button" onClick={remove} disabled={busy}>
        <Trash2 size={14} /> {busy ? "Deleting…" : "Delete all verification photos"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
