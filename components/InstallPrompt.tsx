"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "thoughtfully-install-dismissed-v1";

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem(DISMISS_KEY) === "true") return;

    const handler = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (isIos && !standalone) {
      setIosHint(true);
      setVisible(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="install-prompt" role="status">
      <span className="install-icon"><Download size={17} /></span>
      <div>
        <strong>{iosHint ? "Add Thoughtfully to your Home Screen" : "Install the Thoughtfully app"}</strong>
        <p>{iosHint ? "Tap Share, then Add to Home Screen to enable reminders and a full-screen app." : "Faster access and reliable reminders for your occasions."}</p>
      </div>
      {!iosHint && <button className="install-action" onClick={install}>Install</button>}
      <button className="install-close" onClick={dismiss} aria-label="Dismiss install prompt"><X size={14} /></button>
    </div>
  );
}
