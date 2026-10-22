import { getSecurityConfig } from "./config";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type SecurityEmailRow = { label: string; value: string };

export type SecurityEmailInput = {
  subject: string;
  heading: string;
  intro: string;
  rows: SecurityEmailRow[];
  photoUrl?: string | null;
  attachment?: { filename: string; content: string } | null;
  to?: string | null;
  replyTo?: string | null;
};

function renderHtml(input: SecurityEmailInput) {
  const rows = input.rows
    .map(
      (row) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#7b8177;font-size:13px;white-space:nowrap;vertical-align:top">${escapeHtml(row.label)}</td><td style="padding:6px 0;color:#272c26;font-size:13px;vertical-align:top">${escapeHtml(row.value)}</td></tr>`,
    )
    .join("");

  const photo = input.photoUrl
    ? `<p style="margin:18px 0 0"><a href="${escapeHtml(input.photoUrl)}" style="display:inline-block;background:#4c6044;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 16px;border-radius:8px">Open verification photo</a></p><p style="margin:8px 0 0;color:#7b8177;font-size:11px">The link is private and expires in 7 days. The photo is also attached to this email.</p>`
    : "";
  const attachmentNote = input.attachment
    ? `<p style="margin:8px 0 0;color:#7b8177;font-size:11px">A private copy of the consent photo is attached to this email.</p>`
    : "";

  return `<!doctype html><html><body style="margin:0;background:#f7f7f2;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="background:#fff;border:1px solid #e8e9e1;border-radius:14px;padding:24px">
      <p style="margin:0 0 6px;color:#748467;font-size:11px;letter-spacing:1.4px;font-weight:700">THOUGHTFULLY AI · SECURITY</p>
      <h1 style="margin:0 0 10px;color:#272c26;font-size:20px;line-height:1.3">${escapeHtml(input.heading)}</h1>
      <p style="margin:0 0 16px;color:#5f665c;font-size:13px;line-height:1.6">${escapeHtml(input.intro)}</p>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #eceee6">${rows}</table>
      ${photo}
      ${attachmentNote}
    </div>
    <p style="margin:14px 0 0;color:#9aa095;font-size:11px;line-height:1.6">Sent because this address is configured as the security administrator for Thoughtfully AI. Photos are collected only after the user presses “Verify this device” and are retained for a limited period.</p>
  </div></body></html>`;
}

function renderText(input: SecurityEmailInput) {
  const rows = input.rows.map((row) => `${row.label}: ${row.value}`).join("\n");
  const photo = input.photoUrl ? `\nVerification photo (expires in 7 days): ${input.photoUrl}` : "";
  return `${input.heading}\n\n${input.intro}\n\n${rows}${photo}\n`;
}

/** Sends through Resend's REST API so no extra dependency is required. */
export async function sendSecurityEmail(input: SecurityEmailInput) {
  const config = getSecurityConfig();
  const recipient = input.to ?? config.alertEmail;
  if (!config.resendApiKey || !recipient) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: config.alertFrom,
        to: [recipient],
        subject: input.subject,
        html: renderHtml(input),
        text: renderText(input),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        ...(input.attachment ? { attachments: [input.attachment] } : {}),
      }),
    });
    if (!response.ok) {
      console.warn("Security email failed", response.status, await response.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (caught) {
    console.warn("Security email failed", caught instanceof Error ? caught.message : caught);
    return false;
  }
}
