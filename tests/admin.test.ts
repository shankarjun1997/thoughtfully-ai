import { beforeEach, describe, expect, it } from "vitest";
import { adminEmails, isSecurityAdmin } from "../lib/security/admin";

function clearAdminEnv() {
  delete process.env.SECURITY_ADMIN_EMAILS;
  delete process.env.SECURITY_ALERT_EMAIL;
}

describe("adminEmails", () => {
  beforeEach(clearAdminEnv);

  it("parses a comma-separated allowlist, trims entries and removes duplicates", () => {
    process.env.SECURITY_ADMIN_EMAILS = " Owner@Example.com, ops@example.com ,owner@example.com,, ";
    expect(adminEmails()).toEqual(["owner@example.com", "ops@example.com"]);
  });

  it("falls back to the security alert recipient when no allowlist is set", () => {
    process.env.SECURITY_ALERT_EMAIL = " Alerts@Example.com ";
    expect(adminEmails()).toEqual(["alerts@example.com"]);
  });

  it("prefers the dedicated allowlist over the alert recipient", () => {
    process.env.SECURITY_ADMIN_EMAILS = "admin@example.com";
    process.env.SECURITY_ALERT_EMAIL = "alerts@example.com";
    expect(adminEmails()).toEqual(["admin@example.com"]);
  });

  it("returns an empty list when neither variable is configured", () => {
    expect(adminEmails()).toEqual([]);
  });
});

describe("isSecurityAdmin", () => {
  beforeEach(clearAdminEnv);

  it("matches email addresses case-insensitively and ignores surrounding spaces", () => {
    process.env.SECURITY_ADMIN_EMAILS = "owner@example.com,ops@example.com";
    expect(isSecurityAdmin("owner@example.com")).toBe(true);
    expect(isSecurityAdmin("OWNER@EXAMPLE.COM")).toBe(true);
    expect(isSecurityAdmin("  ops@example.com  ")).toBe(true);
  });

  it("rejects unknown, empty and missing addresses", () => {
    process.env.SECURITY_ADMIN_EMAILS = "owner@example.com";
    expect(isSecurityAdmin("someone@example.com")).toBe(false);
    expect(isSecurityAdmin("owner@example.com.evil.test")).toBe(false);
    expect(isSecurityAdmin("")).toBe(false);
    expect(isSecurityAdmin(null)).toBe(false);
    expect(isSecurityAdmin(undefined)).toBe(false);
  });

  it("uses the alert recipient fallback for matching", () => {
    process.env.SECURITY_ALERT_EMAIL = "alerts@example.com";
    expect(isSecurityAdmin("ALERTS@example.com")).toBe(true);
  });

  it("denies everyone when no administrator is configured", () => {
    expect(isSecurityAdmin("owner@example.com")).toBe(false);
  });
});
