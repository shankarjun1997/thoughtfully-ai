import { NextResponse } from "next/server";
import { PLAN_AMOUNT_PAISE, PLAN_CURRENCY, getBillingConfig } from "@/lib/billing/config";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";
import { activateSubscription } from "@/lib/billing/state";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Notes = Record<string, unknown> | undefined;

type WebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        notes?: Notes;
      };
    };
    order?: {
      entity?: {
        id?: string;
        amount?: number;
        currency?: string;
        notes?: Notes;
      };
    };
  };
};

function noteUserId(notes: Notes) {
  const value = notes?.user_id;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function POST(request: Request) {
  const { webhookSecret } = getBillingConfig();
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const event = payload.event;
  if (event !== "payment.captured" && event !== "order.paid") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const payment = payload.payload?.payment?.entity;
  const order = payload.payload?.order?.entity;
  const paymentId = typeof payment?.id === "string" ? payment.id : null;
  const orderId =
    (typeof payment?.order_id === "string" && payment.order_id) ||
    (typeof order?.id === "string" && order.id) ||
    null;
  const amount = payment?.amount ?? order?.amount;
  const currency = payment?.currency ?? order?.currency;

  if (typeof amount !== "number" || amount !== PLAN_AMOUNT_PAISE) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  if (typeof currency === "string" && currency !== PLAN_CURRENCY) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  if (!paymentId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.error("Razorpay webhook needs SUPABASE_SECRET_KEY to activate the subscription.");
    return NextResponse.json({ error: "Billing storage is not configured." }, { status: 500 });
  }

  let userId = noteUserId(payment?.notes) ?? noteUserId(order?.notes);
  if (!userId && orderId) {
    const { data } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("provider_order_id", orderId)
      .maybeSingle();
    userId = data?.user_id ?? null;
  }

  if (!userId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await activateSubscription(admin, userId, {
    orderId,
    paymentId,
    amountPaise: amount,
    currency,
  });

  if (!result.ok) {
    console.error("Razorpay webhook could not activate subscription", result.error);
    return NextResponse.json({ error: "Could not activate subscription." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
