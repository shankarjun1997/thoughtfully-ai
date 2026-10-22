import { NextResponse } from "next/server";
import { z } from "zod";
import { PLAN_AMOUNT_PAISE, getBillingConfig } from "@/lib/billing/config";
import { fetchRazorpayOrder, verifyPaymentSignature } from "@/lib/billing/razorpay";
import { activateSubscription } from "@/lib/billing/state";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  orderId: z.string().min(1).max(120),
  paymentId: z.string().min(1).max(120),
  signature: z.string().min(1).max(256),
});

export async function POST(request: Request) {
  const config = getBillingConfig();
  if (!config.configured) {
    return NextResponse.json({ error: "Payments are not configured yet." }, { status: 503 });
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payment details." }, { status: 400 });
  }
  const { orderId, paymentId, signature } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  if (!verifyPaymentSignature(orderId, paymentId, signature)) {
    return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });
  }

  try {
    const order = await fetchRazorpayOrder(orderId);
    if (!order.notes?.user_id || order.notes.user_id !== user.id) {
      return NextResponse.json({ error: "This order belongs to a different account." }, { status: 400 });
    }
    if (typeof order.amount === "number" && order.amount !== PLAN_AMOUNT_PAISE) {
      return NextResponse.json({ error: "Unexpected payment amount." }, { status: 400 });
    }
    if (order.currency && order.currency !== config.currency) {
      return NextResponse.json({ error: "Unexpected payment currency." }, { status: 400 });
    }
  } catch (error) {
    console.warn("Could not confirm Razorpay order ownership", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not confirm the payment order. Please contact support." }, { status: 502 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.error("Payment verification needs SUPABASE_SECRET_KEY to activate the subscription.");
    return NextResponse.json({ error: "Billing storage is not configured." }, { status: 500 });
  }

  const result = await activateSubscription(admin, user.id, {
    orderId,
    paymentId,
    amountPaise: config.amountPaise,
    currency: config.currency,
  });

  if (!result.ok) {
    console.error("Could not activate subscription", result.error);
    return NextResponse.json({ error: "Payment received but activation failed. Please contact support." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
