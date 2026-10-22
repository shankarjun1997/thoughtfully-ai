function parseEmails(value: string | undefined) {
  if (!value) return [];
  return Array.from(new Set(
    value
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  ));
}

/**
 * Who may open the security dashboard. A dedicated comma-separated allowlist
 * wins; otherwise the existing single security alert recipient is used.
 */
export function adminEmails(): string[] {
  const configured = parseEmails(process.env.SECURITY_ADMIN_EMAILS);
  if (configured.length) return configured;
  return parseEmails(process.env.SECURITY_ALERT_EMAIL);
}

export function isSecurityAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return adminEmails().includes(normalized);
}
