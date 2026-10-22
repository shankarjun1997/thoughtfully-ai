"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Camera, Check, Loader2, ShieldCheck, X } from "lucide-react";
import type { SessionData } from "@/components/WorkspaceMenu";
import { DEVICE_ID_STORAGE_KEY, DISMISSED_STORAGE_KEY, VERIFIED_STORAGE_KEY } from "@/lib/security/consent";

type VerificationInfo = {
  enabled: boolean;
  due: boolean;
  consentVersion: string;
  consentPoints: string[];
  retentionDays: number;
  validHours: number;
  lastVerifiedAt: string | null;
};

type Status = "idle" | "camera" | "review" | "sending" | "done";

function getDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,128}$/.test(existing)) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function readSessionFlag(key: string) {
  try {
    return sessionStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeSessionFlag(key: string) {
  try {
    sessionStorage.setItem(key, "true");
  } catch {
    // Private-mode browsers may block storage; the prompt simply reappears.
  }
}

export default function SecurityCheck({ session }: { session: SessionData | null }) {
  const [info, setInfo] = useState<VerificationInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState("");
  const checkedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (!session?.configured || !session.user || checkedRef.current) return;
    checkedRef.current = true;

    const currentDevice = getDeviceId();
    setDeviceId(currentDevice);

    fetch("/api/security/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: currentDevice, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.verification) return;
        const verification = body.verification as VerificationInfo;
        setInfo(verification);
        if (verification.due && !readSessionFlag(DISMISSED_STORAGE_KEY) && !readSessionFlag(VERIFIED_STORAGE_KEY)) {
          setOpen(true);
        }
      })
      .catch(() => null);
  }, [session]);

  useEffect(() => {
    if (status !== "camera" || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => null);
  }, [status]);

  async function startCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot access a camera. You can skip verification.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setStatus("camera");
    } catch {
      setError("Camera access was blocked or unavailable. You can review the notice and skip for now.");
    }
  }

  function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError("The camera is still starting. Try again in a moment.");
      return;
    }
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Could not capture the photo. You can skip verification.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.82));
    stopCamera();
    setStatus("review");
  }

  async function sendVerification() {
    if (!photo || !info) return;
    setStatus("sending");
    setError("");
    try {
      const response = await fetch("/api/security/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, consentVersion: info.consentVersion, image: photo }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not send the verification.");
      writeSessionFlag(VERIFIED_STORAGE_KEY);
      setStatus("done");
      window.setTimeout(() => setOpen(false), 2400);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the verification.");
      setStatus("review");
    }
  }

  function dismiss() {
    stopCamera();
    writeSessionFlag(DISMISSED_STORAGE_KEY);
    setOpen(false);
    setPhoto(null);
    setStatus("idle");
  }

  if (!open || !info) return null;

  return (
    <div className="security-overlay">
      <div className="security-card" role="dialog" aria-modal="true" aria-labelledby="security-title">
        <div className="security-head">
          <div className="security-icon"><ShieldCheck size={20} /></div>
          <div className="security-heading">
            <p className="security-eyebrow">ACCOUNT SAFETY · CONSENT REQUIRED</p>
            <h2 id="security-title">{status === "done" ? "This device is verified" : "Verify this device"}</h2>
          </div>
          <button type="button" className="security-close" onClick={dismiss} aria-label="Close and skip verification"><X size={17} /></button>
        </div>

        {status === "done" ? (
          <div className="security-done">
            <span className="security-done-icon"><Check size={22} /></span>
            <p>Thanks. The workspace administrator has been notified that this sign-in was verified.</p>
          </div>
        ) : (
          <>
            <p className="security-intro">
              Help the workspace owner confirm this sign-in is really you. Nothing is captured until you press <strong>Turn on camera</strong>, and you can skip at any time.
            </p>

            <ul className="security-points">
              {info.consentPoints.map((point) => <li key={point}>{point}</li>)}
            </ul>

            <p className="security-retention">Stored privately for {info.retentionDays} days, then deleted automatically.</p>

            {status === "camera" && (
              <div className="security-capture">
                <video ref={videoRef} muted playsInline />
                <span className="security-live-dot">Camera on · recording a single still</span>
              </div>
            )}

            {status === "review" && photo && (
              <div className="security-capture">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="Verification preview captured from your camera" />
                <span className="security-live-dot captured">This photo will be shared with the administrator</span>
              </div>
            )}

            {error && <div className="security-error" role="alert">{error}</div>}

            {(status === "idle" || status === "sending") && (
              <label className="security-consent">
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                <span>I have read the notice and agree to share this photo and session details (IP, browser, approximate location) with the workspace administrator.</span>
              </label>
            )}

            {status === "review" && (
              <label className="security-consent">
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                <span>I agree to send this photo and session details to the workspace administrator.</span>
              </label>
            )}

            <div className="security-actions">
              {status === "idle" && (
                <>
                  <button type="button" className="security-primary" disabled={!consent} onClick={startCamera}><Camera size={15} /> Turn on camera</button>
                  <button type="button" className="security-skip" onClick={dismiss}>Not now</button>
                </>
              )}
              {status === "camera" && (
                <>
                  <button type="button" className="security-primary" onClick={takePhoto}><Camera size={15} /> Take photo</button>
                  <button type="button" className="security-skip" onClick={() => { stopCamera(); setStatus("idle"); }}>Cancel</button>
                </>
              )}
              {status === "review" && (
                <>
                  <button type="button" className="security-primary" disabled={!consent} onClick={sendVerification}>Send verification <ArrowRight size={15} /></button>
                  <button type="button" className="security-skip" onClick={() => { setPhoto(null); setStatus("idle"); startCamera(); }}>Retake</button>
                  <button type="button" className="security-skip" onClick={dismiss}>Not now</button>
                </>
              )}
              {status === "sending" && (
                <button type="button" className="security-primary" disabled><Loader2 size={15} className="spin-icon" /> Sending…</button>
              )}
            </div>
          </>
        )}

        <p className="security-footer">
          <Link href="/security">Manage verification history</Link>
          <span>·</span>
          <span>Photos are never captured in the background.</span>
        </p>
      </div>
    </div>
  );
}
