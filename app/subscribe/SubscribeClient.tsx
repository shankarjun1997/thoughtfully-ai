"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Info, LockKeyhole, RefreshCw } from "lucide-react";

type SubscriptionStatus = "trialing" | "active" | "expired" | "cancelled";

type Props = {
  configured: boolean;
  status: SubscriptionStatus;
  active: boolean;
  paidActive: boolean;
  daysLeft: number;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  next: string;
};

type PaymentSuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler?: (response: PaymentSuccess) => void | Promise<void>;
  modal?: { ondismiss?: () => void };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: string, handler: () => void) => void;
};

type OrderResponse = {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  name: string;
  description: string;
  prefill?: { email?: string; name?: string };
  error?: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let checkoutScript: Promise<boolean> | null = null;

function loadCheckout() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (checkoutScript) return checkoutScript;

  checkoutScript = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => {
      checkoutScript = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return checkoutScript;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function errorMessage(value: unknown, fallback: string) {
  if (value && typeof value === "object" && "error" in value) {
    const error = (value as { error?: unknown }).error;
    if (typeof error === "string" && error.length > 0) return error;
  }
  return fallback;
}

export default function SubscribeClient({
  configured,
  status,
  active,
  paidActive,
  daysLeft,
  trialEndsAt,
  currentPeriodEnd,
  next,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const trialActive = active && !paidActive;
  const trialEndLabel = formatDate(trialEndsAt);
  const periodEndLabel = formatDate(currentPeriodEnd);

  async function startCheckout() {
    setError("");
    setLoading(true);

    try {
      const loaded = await loadCheckout();
      if (!loaded || !window.Razorpay) {
        throw new Error("Could not load Razorpay Checkout. Check your connection and try again.");
      }

      const response = await fetch("/api/billing/order", { method: "POST" });
      const order = (await response.json().catch(() => null)) as OrderResponse | null;

      if (!response.ok || !order || !order.orderId) {
        throw new Error(errorMessage(order, "Could not start checkout. Please try again."));
      }

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        order_id: order.orderId,
        prefill: order.prefill,
        theme: { color: "#4c6044" },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setError("Checkout closed before the payment was completed.");
          },
        },
        handler: async (payment) => {
          try {
            const verified = await fetch("/api/billing/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: payment.razorpay_order_id,
                paymentId: payment.razorpay_payment_id,
                signature: payment.razorpay_signature,
              }),
            });
            const result = await verified.json().catch(() => null);
            if (!verified.ok) {
              throw new Error(errorMessage(result, "We could not confirm your payment."));
            }
            router.replace(next);
            router.refresh();
          } catch (verifyError) {
            setError(
              verifyError instanceof Error
                ? verifyError.message
                : "We could not confirm your payment. If money was deducted, please contact support.",
            );
            setLoading(false);
          }
        },
      });

      checkout.on("payment.failed", () => {
        setError("The payment did not go through. You can try again.");
        setLoading(false);
      });

      checkout.open();
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Could not start checkout.");
      setLoading(false);
    }
  }

  if (paidActive) {
    return (
      <div className="billing-status">
        <span className="billing-badge active"><Check size={11} /> ACTIVE</span>
        <h2>Your annual plan is active.</h2>
        <p>Everything is unlocked for the next year. Thank you for planning thoughtfully with us.</p>
        <div className="billing-meta"><span>Plan</span><strong>Annual · ₹200</strong></div>
        <div className="billing-meta"><span>Valid until</span><strong>{periodEndLabel ?? "—"}</strong></div>
        <div className="billing-meta"><span>Renewal</span><strong>Manual, no auto-renew</strong></div>
        <Link href={next} className="billing-btn primary">Continue to app <ArrowRight size={14} /></Link>
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="billing-status">
        <span className="billing-badge open">OPEN ACCESS</span>
        <h2>Payments are not configured yet.</h2>
        <p>You are not locked out. Billing will start once Razorpay keys are added to the deployment.</p>
        <div className="billing-note"><Info size={14} /> Your trial and all features remain available while billing is off.</div>
        <Link href={next} className="billing-btn primary">Continue to app <ArrowRight size={14} /></Link>
      </div>
    );
  }

  if (trialActive) {
    return (
      <div className="billing-status">
        <span className="billing-badge trial">FREE TRIAL</span>
        <h2>{daysLeft === 1 ? "1 day left in your trial." : `${daysLeft} days left in your trial.`}</h2>
        <p>
          Your free trial ends on {trialEndLabel ?? "—"}. After that, a one-time ₹200 payment unlocks a full year.
        </p>
        <div className="billing-meta"><span>Trial ends</span><strong>{trialEndLabel ?? "—"}</strong></div>
        <div className="billing-meta"><span>Then</span><strong>₹200 / year</strong></div>
        <Link href={next} className="billing-btn primary">Continue planning <ArrowRight size={14} /></Link>
        <p className="billing-secure"><LockKeyhole size={12} /> We will ask for payment only after your trial ends.</p>
      </div>
    );
  }

  return (
    <div className="billing-status">
      <span className="billing-badge expired"><RefreshCw size={11} /> {status === "cancelled" ? "INACTIVE" : "TRIAL ENDED"}</span>
      <h2>{status === "cancelled" ? "Your plan is inactive." : "Your free trial has ended."}</h2>
      <p>
        {status === "cancelled"
          ? "Reactivate with a one-time ₹200 payment to keep your plans, lists and reminders."
          : `Your trial finished on ${trialEndLabel ?? "—"}. Pay once to unlock Thoughtfully AI for a full year.`}
      </p>
      <div className="billing-meta"><span>Annual plan</span><strong>₹200 · 365 days</strong></div>
      <div className="billing-meta"><span>Renewal</span><strong>Manual, no auto-renew</strong></div>

      {error && <div className="billing-alert" role="alert">{error}</div>}

      <button type="button" className="billing-btn primary" onClick={startCheckout} disabled={loading}>
        {loading ? <><span className="billing-spinner" /> Starting checkout…</> : <>Pay ₹200 · 1 year <ArrowRight size={14} /></>}
      </button>
      <p className="billing-secure"><LockKeyhole size={12} /> Secure checkout by Razorpay · UPI, cards and netbanking</p>
    </div>
  );
}
