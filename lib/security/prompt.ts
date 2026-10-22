export type VerificationPromptInput = {
  enabled: boolean;
  required: boolean;
  due: boolean;
  dismissed: boolean;
  verified: boolean;
};

/**
 * Decides whether the blocking verification dialog should open.
 * Required mode ignores "Not now" so the check cannot be skipped in a
 * browser session, but a successful verification still unlocks it until the
 * tab/session ends or the user signs in again.
 */
export function shouldPromptVerification(input: VerificationPromptInput) {
  if (!input.enabled) return false;
  if (input.required) return !input.verified;
  return input.due && !input.dismissed && !input.verified;
}
