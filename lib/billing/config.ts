export const TRIAL_DAYS = 7;
export const PLAN_AMOUNT_PAISE = 20000;
export const PLAN_CURRENCY = "INR";
export const PLAN_PERIOD_DAYS = 365;
export const PLAN_NAME = "Thoughtfully AI";
export const PLAN_DESCRIPTION = "Annual plan — ₹200";
export const PLAN_THEME_COLOR = "#4c6044";

export type BillingConfig = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  configured: boolean;
  amountPaise: number;
  currency: string;
  periodDays: number;
  trialDays: number;
};

export function getBillingConfig(): BillingConfig {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() ?? "";
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? "";

  return {
    keyId,
    keySecret,
    webhookSecret,
    configured: Boolean(keyId && keySecret),
    amountPaise: PLAN_AMOUNT_PAISE,
    currency: PLAN_CURRENCY,
    periodDays: PLAN_PERIOD_DAYS,
    trialDays: TRIAL_DAYS,
  };
}
