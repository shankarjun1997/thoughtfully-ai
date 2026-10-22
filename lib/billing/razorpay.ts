import { createHmac, timingSafeEqual } from "node:crypto";
import { PLAN_AMOUNT_PAISE, PLAN_CURRENCY, getBillingConfig } from "./config";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status?: string;
  receipt?: string;
  notes?: Record<string, string>;
};

function basicAuth(keyId: string, keySecret: string) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

function signaturesMatch(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(received.trim().toLowerCase(), "utf8");
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function signPayment(orderId: string, paymentId: string, secret: string) {
  return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

export function signWebhook(rawBody: string, secret: string) {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
  const { keySecret } = getBillingConfig();
  if (!keySecret) return false;
  return signaturesMatch(signPayment(orderId, paymentId, keySecret), signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string) {
  const { webhookSecret } = getBillingConfig();
  if (!webhookSecret) return false;
  return signaturesMatch(signWebhook(rawBody, webhookSecret), signature);
}

export async function createRazorpayOrder(userId: string): Promise<RazorpayOrder> {
  const { keyId, keySecret, configured } = getBillingConfig();
  if (!configured) throw new Error("Razorpay is not configured.");

  const response = await fetch(`${RAZORPAY_API}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuth(keyId, keySecret),
    },
    body: JSON.stringify({
      amount: PLAN_AMOUNT_PAISE,
      currency: PLAN_CURRENCY,
      receipt: `tg_${userId.slice(0, 8)}_${Date.now()}`,
      notes: { user_id: userId },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Razorpay order failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }

  return (await response.json()) as RazorpayOrder;
}

export async function fetchRazorpayOrder(orderId: string): Promise<RazorpayOrder> {
  const { keyId, keySecret, configured } = getBillingConfig();
  if (!configured) throw new Error("Razorpay is not configured.");

  const response = await fetch(`${RAZORPAY_API}/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: basicAuth(keyId, keySecret) },
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Razorpay order lookup failed (${response.status})`);
  return (await response.json()) as RazorpayOrder;
}
