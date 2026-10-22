import { NextResponse } from "next/server";
import { PLAN_DESCRIPTION, PLAN_NAME, getBillingConfig } from "@/lib/billing/config";
import { createRazorpayOrder } from "@/lib/billing/razorpay";
import { getBillingState } from "@/lib/billing/state";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const config = getBillingConfig();
  if (!config.configured) {
    return NextResponse.json({ error: "Payments are not configured yet." }, { status: 503 });
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const state = await getBillingState(supabase, user);
  if (state.status === "active" && state.active) {
    return NextResponse.json({ error: "Your plan is already active." }, { status: 409 });
  }

  let order;
  try {
    order = await createRazorpayOrder(user.id);
  } catch (error) {
    console.error("Could not create Razorpay order", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }

  const admin = createSupabaseAdminClient();
  if (admin) {
    const now = new Date().toISOString();
    const { data: updated, error } = await admin
      .from("subscriptions")
      .update({
        provider: "razorpay",
        provider_order_id: order.id,
        amount_paise: config.amountPaise,
        currency: config.currency,
        updated_at: now,
      })
      .eq("user_id", user.id)
      .select("user_id");

    if (!error && (!updated || updated.length === 0)) {
      const createdAt = user.created_at ? new Date(user.created_at).getTime() : Date.now();
      const trialEndsAt = new Date(createdAt + config.trialDays * 86_400_000).toISOString();
      const { error: insertError } = await admin.from("subscriptions").insert({
        user_id: user.id,
        status: "trialing",
        trial_ends_at: trialEndsAt,
        provider: "razorpay",
        provider_order_id: order.id,
        amount_paise: config.amountPaise,
        currency: config.currency,
        updated_at: now,
      });
      if (insertError) {
        console.warn("Could not persist Razorpay order", insertError.message);
      }
    } else if (error) {
      console.warn("Could not persist Razorpay order", error.message);
    }
  } else {
    console.warn("Billing order created without a service-role client; order id was not persisted.");
  }

  const metadata = user.user_metadata ?? {};
  const prefillName =
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    (typeof metadata.name === "string" && metadata.name) ||
    "";

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount ?? config.amountPaise,
    currency: order.currency ?? config.currency,
    keyId: config.keyId,
    name: PLAN_NAME,
    description: PLAN_DESCRIPTION,
    prefill: {
      email: user.email ?? "",
      name: prefillName,
    },
  });
}
