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

export type UserVerificationEmailInput = {
  to: string;
  name: string;
  verifiedAt: string;
  location: string;
  browser: string;
  retentionDays: number;
  appUrl: string;
  supportEmail?: string | null;
};

function safeAppUrl(value: string) {
  return /^https?:\/\/[^\s<>"]+$/i.test(value) ? value : "https://thoughtfully-ai.vercel.app";
}

export function renderUserVerificationEmail(input: UserVerificationEmailInput) {
  const appUrl = safeAppUrl(input.appUrl);
  const support = input.supportEmail
    ? `<p style="margin:14px 0 0;color:#7b8177;font-size:12px;line-height:1.6">If this was not you, sign in, open <strong>Security</strong>, delete the verification, then change your password. Questions? <a href="mailto:${escapeHtml(input.supportEmail)}" style="color:#4c6044">Contact the administrator</a>.</p>`
    : `<p style="margin:14px 0 0;color:#7b8177;font-size:12px;line-height:1.6">If this was not you, sign in, open <strong>Security</strong>, delete the verification, then change your password.</p>`;

  const rows = [
    ["Verified at", input.verifiedAt],
    ["Device", input.browser],
    ["Approx. location", input.location],
    ["Photo retention", `${input.retentionDays} days, then deleted automatically`],
  ]
    .map(
      ([label, value]) =>
        `<tr><td style="padding:7px 14px 7px 0;color:#8a9085;font-size:12px;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:7px 0;color:#3d4738;font-size:12px;vertical-align:top">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Verification successful</title>
</head>
<body style="margin:0;padding:0;background:#f7f7f2;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Your Thoughtfully device verification was successful.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f2;">
    <tr>
      <td align="center" style="padding:30px 14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding:0 4px 14px;font-family:'DM Sans',Arial,sans-serif;font-size:19px;font-weight:700;letter-spacing:-.8px;color:#272c26;">
              thoughtfully<span style="font-size:10px;background:#edf1e8;color:#4c6044;padding:3px 5px;border-radius:5px;margin-left:5px;vertical-align:middle;letter-spacing:0;">AI</span>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border:1px solid #e8e9e1;border-radius:16px;padding:30px 28px;font-family:'DM Sans',Arial,sans-serif;">
              <div style="width:52px;height:52px;border-radius:50%;background:#eef3e8;color:#4c6044;font-size:26px;line-height:52px;text-align:center;margin:0 0 18px;">&#10003;</div>
              <p style="margin:0 0 8px;color:#748467;font-size:10px;letter-spacing:1.5px;font-weight:700;">VERIFICATION SUCCESSFUL</p>
              <h1 style="margin:0 0 12px;color:#272c26;font-size:24px;line-height:1.3;font-weight:600;letter-spacing:-.5px;">You&rsquo;re verified, ${escapeHtml(input.name)}</h1>
              <p style="margin:0 0 20px;color:#5f665c;font-size:14px;line-height:1.7;">
                This confirms that the session check on your Thoughtfully account was completed successfully. Your workspace is ready whenever you are.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eff0e9;border-bottom:1px solid #eff0e9;padding:6px 0;">
                ${rows}
              </table>
              ${support}
              <p style="margin:24px 0 0;">
                <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#4c6044;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:12px 20px;border-radius:9px;">Open Thoughtfully</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 6px 0;color:#9aa095;font-size:11px;line-height:1.7;font-family:'DM Sans',Arial,sans-serif;">
              You received this one-time confirmation because you completed a session verification on Thoughtfully AI. This is not a marketing email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Verification successful`,
    ``,
    `Hi ${input.name},`,
    ``,
    `The session check on your Thoughtfully account was completed successfully.`,
    ``,
    `Verified at: ${input.verifiedAt}`,
    `Device: ${input.browser}`,
    `Approx. location: ${input.location}`,
    `Photo retention: ${input.retentionDays} days, then deleted automatically`,
    ``,
    `If this was not you, sign in, open Security, delete the verification, then change your password.`,
    ...(input.supportEmail ? [`Questions? Contact the administrator: ${input.supportEmail}`] : []),
    ``,
    `Open Thoughtfully: ${appUrl}`,
  ].join("\n");

  return { html, text };
}

/** Sends a one-time confirmation email to the account holder after verification. */
export async function sendUserVerificationEmail(input: UserVerificationEmailInput) {
  const config = getSecurityConfig();
  if (!config.resendApiKey || !config.notifyUser || !input.to) return false;
  const { html, text } = renderUserVerificationEmail(input);

  return postResendEmail({
    to: [input.to],
    subject: "Your Thoughtfully device is verified",
    html,
    text,
    ...(config.alertEmail ? { reply_to: config.alertEmail } : {}),
  }, "User verification email");
}

/** Sends through Resend's REST API so no extra dependency is required. */
function postResendEmail(payload: Record<string, unknown>, label: string) {
  const config = getSecurityConfig();
  if (!config.resendApiKey) return Promise.resolve(false);

  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: config.alertFrom, ...payload }),
  })
    .then(async (response) => {
      if (!response.ok) {
        console.warn(`${label} failed`, response.status, await response.text().catch(() => ""));
        return false;
      }
      return true;
    })
    .catch((caught) => {
      console.warn(`${label} failed`, caught instanceof Error ? caught.message : caught);
      return false;
    });
}

export async function sendSecurityEmail(input: SecurityEmailInput) {
  const config = getSecurityConfig();
  const recipient = input.to ?? config.alertEmail;
  if (!recipient) return false;

  return postResendEmail({
    to: [recipient],
    subject: input.subject,
    html: renderHtml(input),
    text: renderText(input),
    ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    ...(input.attachment ? { attachments: [input.attachment] } : {}),
  }, "Security email");
}
