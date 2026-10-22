"use client";

import { useState } from "react";
import { AlertTriangle, Check, Download, Loader2, Trash2 } from "lucide-react";

export default function AccountActions({ email }: { email: string }) {
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState("");
  const [exportError, setExportError] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function exportData() {
    setExporting(true);
    setExportNotice("");
    setExportError("");
    try {
      const response = await fetch("/api/account/export", { headers: { Accept: "application/json" } });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Could not prepare your export.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? "thoughtfully-account-export.json";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportNotice("Your export has been downloaded. It contains account metadata, not verification photos.");
    } catch (caught) {
      setExportError(caught instanceof Error ? caught.message : "Could not prepare your export.");
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    if (confirmation !== "DELETE") return;
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not delete your account.");
      window.location.href = "/login";
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "Could not delete your account.");
      setDeleting(false);
    }
  }

  return (
    <>
      <section className="account-card">
        <div className="account-card-head">
          <span className="account-card-icon"><Download size={18} /></span>
          <div>
            <h2>Export your data</h2>
            <p>Download a JSON copy of your profile, workspaces, subscription status, verification metadata and login devices.</p>
          </div>
        </div>
        <p className="account-card-note">
          For your safety, the export never includes verification photos or signed image links.
        </p>
        <button type="button" className="account-button" onClick={exportData} disabled={exporting}>
          {exporting ? <Loader2 size={15} className="spin-icon" /> : <Download size={15} />}
          {exporting ? "Preparing export…" : "Export account data"}
        </button>
        {exportNotice && <div className="account-message success" role="status"><Check size={13} /> {exportNotice}</div>}
        {exportError && <div className="account-message error" role="alert">{exportError}</div>}
      </section>

      <section className="account-card danger">
        <div className="account-card-head">
          <span className="account-card-icon danger"><AlertTriangle size={18} /></span>
          <div>
            <h2>Delete account</h2>
            <p>Permanently delete {email}, verification photos, workspaces and related records. This cannot be undone.</p>
          </div>
        </div>

        {!deleteOpen ? (
          <button type="button" className="account-button danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={15} /> Delete my account
          </button>
        ) : (
          <div className="account-delete-flow">
            <label className="account-confirm-label" htmlFor="delete-confirmation">
              Type <strong>DELETE</strong> to confirm
            </label>
            <input
              id="delete-confirmation"
              className="account-confirm-input"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="DELETE"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <div className="account-delete-actions">
              <button type="button" className="account-button danger" onClick={deleteAccount} disabled={deleting || confirmation !== "DELETE"}>
                {deleting ? <Loader2 size={15} className="spin-icon" /> : <Trash2 size={15} />}
                {deleting ? "Deleting…" : "Permanently delete account"}
              </button>
              <button type="button" className="account-button quiet" onClick={() => { setDeleteOpen(false); setConfirmation(""); setDeleteError(""); }} disabled={deleting}>
                Cancel
              </button>
            </div>
            {deleteError && <div className="account-message error" role="alert">{deleteError}</div>}
          </div>
        )}
      </section>
    </>
  );
}
