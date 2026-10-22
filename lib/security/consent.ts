/**
 * Consent copy is shared by the browser prompt and the server so the version
 * recorded in the database always matches what the person agreed to.
 */
export const SESSION_CONSENT_VERSION = "2026-10-22.1";

export const SESSION_CONSENT_POINTS = [
  "A single photo is taken from your camera only after you press “Verify this device”. No audio is recorded.",
  "The photo, your account email, IP address, browser details and approximate location are shared with the workspace administrator (the platform owner) for safety review.",
  "Photos are kept privately in this app for a limited time, then deleted automatically.",
];

export function sessionConsentPoints(required: boolean) {
  return [
    ...SESSION_CONSENT_POINTS,
    required
      ? "Verification is required to keep using this workspace. You can sign out instead, and you can delete your verification history at any time."
      : "Verification is optional. You can press “Not now”, keep using your account, and delete your verification history at any time.",
  ];
}

export const VERIFICATION_VALID_HOURS = 24;
export const DEFAULT_RETENTION_DAYS = 30;

export const DEVICE_ID_STORAGE_KEY = "thoughtfully-device-id-v1";
export const DISMISSED_STORAGE_KEY = "thoughtfully-security-dismissed-v1";
export const VERIFIED_STORAGE_KEY = "thoughtfully-security-verified-v1";
