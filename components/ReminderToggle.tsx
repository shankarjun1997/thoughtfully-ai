"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import type { SessionData } from "@/components/WorkspaceMenu";
import type { PlannerEvent } from "@/lib/types";

const STORAGE_KEY = "thoughtfully-reminders-enabled-v1";

function applicationServerKey(value: string) {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function supportsPush() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export default function ReminderToggle({ session, events }: { session: SessionData | null; events: PlannerEvent[] }) {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSupported(supportsPush());
    setEnabled(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  const workspaceId = session?.activeWorkspaceId;
  const ready = Boolean(session?.configured && session.user && workspaceId);

  async function getRegistration() {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return registration;
  }

  async function enable() {
    if (!ready) {
      setMessage("Sign in and choose a workspace to turn on reminders.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notifications are blocked in this browser. Allow them in site settings, then try again.");

      const registration = await getRegistration();
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""),
      });
      const json = subscription.toJSON();

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          subscription: { endpoint: json.endpoint, keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth } },
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not save your notification subscription.");

      const today = new Date().toISOString().slice(0, 10);
      await Promise.all(events.filter((event) => event.date >= today).map((event) => fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, event }),
      }).catch(() => null)));

      localStorage.setItem(STORAGE_KEY, "true");
      setEnabled(true);
      setMessage("Reminders are on. We will notify you one day before at 9:00 AM IST.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not enable reminders.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => null);
        await subscription.unsubscribe();
      }
      localStorage.setItem(STORAGE_KEY, "false");
      setEnabled(false);
      setMessage("Reminders are off.");
    } catch {
      setMessage("Could not turn off reminders.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!workspaceId) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/push/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not send a test.");
      setMessage(body.sent ? "Test notification sent." : "No subscription found on the server. Turn reminders off and on again.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send a test.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="reminder-toggle">
      <button
        type="button"
        className={`reminder-button ${enabled ? "on" : ""}`}
        onClick={enabled ? disable : enable}
        disabled={busy || !supported}
        title={supported ? "One day before at 9:00 AM IST" : "This browser does not support web push"}
      >
        {busy ? <Loader2 size={14} className="spin-icon" /> : enabled ? <Bell size={14} /> : <BellOff size={14} />}
        {enabled ? "Reminders on" : "Enable reminders"}
      </button>
      {enabled && <button type="button" className="reminder-test" onClick={sendTest} disabled={busy} title="Send a test notification"><Send size={13} /></button>}
      {message && <span className="reminder-message">{message}</span>}
      {!supported && <span className="reminder-message">This browser does not support web push.</span>}
    </div>
  );
}
