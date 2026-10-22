import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PLAN_AMOUNT_PAISE,
  PLAN_CURRENCY,
  PLAN_PERIOD_DAYS,
  TRIAL_DAYS,
  getBillingConfig,
} from "./config";

const DAY_MS = 86_400_000;

export type SubscriptionStatus = "trialing" | "active" | "expired" | "cancelled";

export type BillingState = {
  configured: boolean;
  status: SubscriptionStatus;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  daysLeft: number;
  active: boolean;
  requiresPayment: boolean;
};

export type BillingUser = {
  id: string;
  created_at?: string | null;
};

type SubscriptionRow = {
  status: SubscriptionStatus | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  provider_payment_id?: string | null;
};

export type ActivationDetails = {
  orderId: string | null;
  paymentId: string | null;
  amountPaise?: number | null;
  currency?: string | null;
};

function trialEndFor(user: BillingUser) {
  const createdAt = user.created_at ? new Date(user.created_at).getTime() : Number.NaN;
  const base = Number.isFinite(createdAt) ? createdAt : Date.now();
  return new Date(base + TRIAL_DAYS * DAY_MS);
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function getBillingState(supabase: SupabaseClient, user: BillingUser): Promise<BillingState> {
  const config = getBillingConfig();
  const now = Date.now();
  const fallbackTrialEnd = trialEndFor(user);

  let row: SubscriptionRow | null = null;
  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("status, trial_ends_at, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!error && data) row = data as SubscriptionRow;
  } catch {
    // A missing table (migration not applied yet) behaves like a fresh trial.
    row = null;
  }

  const storedStatus = (row?.status ?? "trialing") as SubscriptionStatus;
  const trialEndsAt = parseDate(row?.trial_ends_at) ?? fallbackTrialEnd;
  const currentPeriodEnd = parseDate(row?.current_period_end);
  const trialActive = trialEndsAt.getTime() > now;
  const paidActive = storedStatus === "active" && Boolean(currentPeriodEnd && currentPeriodEnd.getTime() > now);
  const active = paidActive || trialActive;

  let status: SubscriptionStatus;
  if (paidActive) status = "active";
  else if (trialActive) status = "trialing";
  else status = storedStatus === "cancelled" ? "cancelled" : "expired";

  const endsAt = paidActive && currentPeriodEnd ? currentPeriodEnd : trialEndsAt;
  const daysLeft = active ? Math.max(0, Math.ceil((endsAt.getTime() - now) / DAY_MS)) : 0;

  return {
    configured: config.configured,
    status,
    trialEndsAt: trialEndsAt.toISOString(),
    currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null,
    daysLeft,
    active,
    requiresPayment: config.configured && !active,
  };
}

export async function activateSubscription(
  client: SupabaseClient,
  userId: string,
  details: ActivationDetails,
): Promise<{ ok: boolean; alreadyActive?: boolean; error?: string }> {
  const now = new Date();

  if (details.paymentId) {
    const { data: existing } = await client
      .from("subscriptions")
      .select("provider_payment_id, status")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing?.provider_payment_id && existing.provider_payment_id === details.paymentId) {
      return { ok: true, alreadyActive: true };
    }
  }

  const payload = {
    status: "active",
    current_period_end: new Date(now.getTime() + PLAN_PERIOD_DAYS * DAY_MS).toISOString(),
    provider: "razorpay",
    provider_order_id: details.orderId,
    provider_payment_id: details.paymentId,
    amount_paise: details.amountPaise ?? PLAN_AMOUNT_PAISE,
    currency: details.currency ?? PLAN_CURRENCY,
    updated_at: now.toISOString(),
  };

  const { data: updated, error } = await client
    .from("subscriptions")
    .update(payload)
    .eq("user_id", userId)
    .select("user_id");

  if (error) return { ok: false, error: error.message };
  if (updated && updated.length > 0) return { ok: true };

  const { error: insertError } = await client.from("subscriptions").insert({
    user_id: userId,
    trial_ends_at: new Date(now.getTime() + TRIAL_DAYS * DAY_MS).toISOString(),
    ...payload,
  });

  if (insertError) return { ok: false, error: insertError.message };
  return { ok: true };
}
