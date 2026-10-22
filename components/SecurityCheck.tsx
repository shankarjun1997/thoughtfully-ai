"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, Check, Loader2, ShieldCheck, X } from "lucide-react";
import type { SessionData } from "@/components/WorkspaceMenu";
import { DEVICE_ID_STORAGE_KEY, DISMISSED_STORAGE_KEY, VERIFIED_STORAGE_KEY } from "@/lib/security/consent";
import {
  blinkScores,
  detectBlink,
  evaluateFaceAlignment,
  faceBoxFromLandmarks,
  loadFaceLandmarker,
  type FaceLandmarkerHandle,
} from "@/lib/security/face";
import { shouldPromptVerification } from "@/lib/security/prompt";

type VerificationInfo = {
  enabled: boolean;
  required: boolean;
  due: boolean;
  consentVersion: string;
  consentPoints: string[];
  retentionDays: number;
  validHours: number;
  lastVerifiedAt: string | null;
};

type Status = "idle" | "camera" | "review" | "sending" | "done";

type LivenessMethod = "face_blink" | "manual_fallback";

type LivenessState = "starting" | "center" | "closer" | "blink" | "hold" | "countdown" | "fallback";

const ALIGN_HOLD_MS = 800;
const HOLD_AFTER_BLINK_MS = 400;
const COUNTDOWN_MS = 2100;
const BLINK_ARM_SCORE = 0.25;

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

export default function SecurityCheck({
  session,
  mode = "modal",
  next = "/",
}: {
  session: SessionData | null;
  mode?: "modal" | "page";
  next?: string;
}) {
  const router = useRouter();
  const maskId = `security-oval-mask-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const [info, setInfo] = useState<VerificationInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState("");
  const [liveness, setLiveness] = useState<LivenessState>("starting");
  const [aligned, setAligned] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [fallbackAvailable, setFallbackAvailable] = useState(false);
  const [faceCheckFailed, setFaceCheckFailed] = useState(false);
  const checkedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarkerHandle | null>(null);
  const rafRef = useRef<number | null>(null);
  const alignedSinceRef = useRef(0);
  const eyesOpenRef = useRef(false);
  const blinkSeenRef = useRef(false);
  const blinkAtRef = useRef(0);
  const captureAtRef = useRef(0);
  const capturedRef = useRef(false);
  const methodRef = useRef<LivenessMethod>("manual_fallback");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopDetection = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    stopDetection();
    stopCamera();
  }, [stopCamera, stopDetection]);

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

        if (mode === "page") {
          if (!verification.enabled || !verification.required || body.gateSatisfied) {
            router.replace(next);
            return;
          }
          setOpen(true);
          return;
        }

        setOpen(shouldPromptVerification({
          enabled: verification.enabled,
          required: verification.required,
          due: verification.due,
          dismissed: readSessionFlag(DISMISSED_STORAGE_KEY),
          verified: readSessionFlag(VERIFIED_STORAGE_KEY) || Boolean(body.gateSatisfied),
        }));
      })
      .catch(() => null);
  }, [mode, next, router, session]);

  useEffect(() => {
    if (status !== "camera" || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => null);
  }, [status]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const captureFrame = useCallback((nextMethod: LivenessMethod) => {
    if (capturedRef.current) return;
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
      setError("Could not capture the photo. Please try again.");
      return;
    }

    capturedRef.current = true;
    methodRef.current = nextMethod;
    stopDetection();
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.82));
    stopCamera();
    setStatus("review");
  }, [stopCamera, stopDetection]);

  useEffect(() => {
    if (status !== "camera") return;
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let lastTimestamp = 0;
    let lastCountdownUpdate = 0;

    alignedSinceRef.current = 0;
    eyesOpenRef.current = false;
    blinkSeenRef.current = false;
    blinkAtRef.current = 0;
    captureAtRef.current = 0;
    capturedRef.current = false;
    methodRef.current = "manual_fallback";
    setAligned(false);
    setCountdown(3);
    setFallbackAvailable(false);
    setFaceCheckFailed(false);
    setLiveness("starting");

    const startDetection = async () => {
      try {
        const landmarker = await loadFaceLandmarker();
        if (cancelled) return;
        landmarkerRef.current = landmarker;
        setLiveness("center");

        const tick = () => {
          if (cancelled || capturedRef.current) return;
          const node = videoRef.current;
          if (!node || node.readyState < 2 || !node.videoWidth || !node.videoHeight) {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }

          const now = performance.now();
          const timestamp = Math.max(lastTimestamp + 1, now);
          lastTimestamp = timestamp;

          if (captureAtRef.current > 0) {
            const remaining = captureAtRef.current - now;
            if (remaining <= 0) {
              setCountdown(0);
              captureFrame("face_blink");
              return;
            }
            if (now - lastCountdownUpdate > 120) {
              lastCountdownUpdate = now;
              setCountdown(Math.max(1, Math.ceil(remaining / (COUNTDOWN_MS / 3))));
            }
            rafRef.current = requestAnimationFrame(tick);
            return;
          }

          let result;
          try {
            result = landmarker.detectForVideo(node, timestamp);
          } catch {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }

          const landmarks = result.faceLandmarks?.[0];
          if (!landmarks?.length) {
            alignedSinceRef.current = 0;
            eyesOpenRef.current = false;
            setAligned(false);
            setLiveness("center");
            rafRef.current = requestAnimationFrame(tick);
            return;
          }

          const box = faceBoxFromLandmarks(landmarks, node.videoWidth, node.videoHeight);
          const alignment = evaluateFaceAlignment(box, node.videoWidth, node.videoHeight);

          if (alignment.reason === "too-small") {
            alignedSinceRef.current = 0;
            setAligned(false);
            setLiveness("closer");
            rafRef.current = requestAnimationFrame(tick);
            return;
          }
          if (!alignment.aligned) {
            alignedSinceRef.current = 0;
            setAligned(false);
            setLiveness("center");
            rafRef.current = requestAnimationFrame(tick);
            return;
          }

          setAligned(true);
          if (!alignedSinceRef.current) alignedSinceRef.current = now;

          const scores = blinkScores(result.faceBlendshapes);
          if (scores.left < BLINK_ARM_SCORE && scores.right < BLINK_ARM_SCORE) {
            eyesOpenRef.current = true;
          }
          if (eyesOpenRef.current && detectBlink(result.faceBlendshapes)) {
            eyesOpenRef.current = false;
            blinkSeenRef.current = true;
            blinkAtRef.current = now;
          }

          if (!blinkSeenRef.current) {
            setLiveness("blink");
          } else if (now - alignedSinceRef.current >= ALIGN_HOLD_MS && now - blinkAtRef.current >= HOLD_AFTER_BLINK_MS) {
            captureAtRef.current = now + COUNTDOWN_MS;
            lastCountdownUpdate = now;
            setCountdown(3);
            setLiveness("countdown");
          } else {
            setLiveness("hold");
          }

          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
      } catch {
        if (cancelled) return;
        setFaceCheckFailed(true);
        setFallbackAvailable(true);
        setLiveness("fallback");
      }
    };

    startDetection();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [captureFrame, status]);

  async function startCamera() {
    setError("");
    setPhoto(null);
    setAligned(false);
    setFallbackAvailable(false);
    setFaceCheckFailed(false);
    setLiveness("starting");
    setCountdown(3);
    methodRef.current = "manual_fallback";
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(info?.required
        ? "This browser cannot access a camera, but verification is required to continue. Try a supported browser, or sign out."
        : "This browser cannot access a camera. You can skip verification.");
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
      setError(info?.required
        ? "Camera access is required to continue. Allow camera access in your browser settings and try again, or sign out."
        : "Camera access was blocked or unavailable. You can review the notice and skip for now.");
    }
  }

  async function sendVerification() {
    if (!photo || !info) return;
    setStatus("sending");
    setError("");
    try {
      const response = await fetch("/api/security/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          consentVersion: info.consentVersion,
          image: photo,
          livenessMethod: methodRef.current,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not send the verification.");
      writeSessionFlag(VERIFIED_STORAGE_KEY);
      setStatus("done");
      if (mode === "page") {
        window.setTimeout(() => {
          router.replace(next);
          router.refresh();
        }, 900);
      } else {
        window.setTimeout(() => setOpen(false), 2400);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the verification.");
      setStatus("review");
    }
  }

  function dismiss() {
    if (info?.required || mode === "page") return;
    stopDetection();
    stopCamera();
    writeSessionFlag(DISMISSED_STORAGE_KEY);
    setOpen(false);
    setPhoto(null);
    setStatus("idle");
  }

  if (mode === "page" && !info) {
    return (
      <div className="security-card security-card-page" aria-busy="true">
        <div className="security-head">
          <div className="security-icon"><ShieldCheck size={20} /></div>
          <div className="security-heading">
            <p className="security-eyebrow">ACCOUNT SAFETY · VERIFICATION REQUIRED</p>
            <h2>Preparing secure check…</h2>
          </div>
          <Loader2 size={18} className="spin-icon" />
        </div>
      </div>
    );
  }

  if (!open || !info) return null;

  const signOutForm = (
    <form action="/auth/signout" method="post" className="security-signout">
      <button type="submit">Sign out instead</button>
    </form>
  );

  const livenessCopy = liveness === "countdown"
    ? `Capturing in ${countdown}…`
    : liveness === "blink"
      ? "Blink to confirm you're present"
      : liveness === "hold"
        ? "Hold still"
        : liveness === "closer"
          ? "Move closer"
          : liveness === "fallback"
            ? "Face check unavailable"
            : liveness === "starting"
              ? "Starting face check…"
              : "Center your face in the oval";

  const card = (
    <div className="security-card" role="dialog" aria-modal={mode === "modal"} aria-labelledby="security-title">
      <div className="security-head">
        <div className="security-icon"><ShieldCheck size={20} /></div>
        <div className="security-heading">
          <p className="security-eyebrow">{info.required ? "ACCOUNT SAFETY · VERIFICATION REQUIRED" : "ACCOUNT SAFETY · OPTIONAL CHECK"}</p>
          <h2 id="security-title">{status === "done" ? "This device is verified" : "Verify this device"}</h2>
        </div>
        {!info.required && mode === "modal" && (
          <button type="button" className="security-close" onClick={dismiss} aria-label="Close and skip verification"><X size={17} /></button>
        )}
      </div>

      {status === "done" ? (
        <div className="security-done">
          <span className="security-done-icon"><Check size={22} /></span>
          <p>
            {mode === "page"
              ? "Verified. Opening your workspace…"
              : "Thanks. The workspace administrator has been notified that this sign-in was verified."}
          </p>
        </div>
      ) : (
        <>
          <p className="security-intro">
            {info.required ? (
              <>Verification is required to use this workspace. Confirm this sign-in is really you — nothing is captured until you press <strong>Turn on camera</strong>. You can sign out instead if you do not want to continue.</>
            ) : (
              <>Help the workspace owner confirm this sign-in is really you. Nothing is captured until you press <strong>Turn on camera</strong>, and you can skip at any time.</>
            )}
          </p>

          <ul className="security-points">
            {info.consentPoints.map((point) => <li key={point}>{point}</li>)}
          </ul>

          <p className="security-local-note">
            Face detection runs only in your browser. No face template or biometric identifier is stored, and the captured photo is shared with the workspace administrator.
          </p>

          <p className="security-retention">Stored privately for {info.retentionDays} days, then deleted automatically.</p>

          {status === "camera" && (
            <>
              <div className={`security-capture security-liveness${aligned ? " is-aligned" : ""}`}>
                <video ref={videoRef} muted playsInline />
                <svg className="security-oval" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <mask id={maskId}>
                      <rect width="100" height="100" fill="#fff" />
                      <ellipse cx="50" cy="50" rx="23" ry="36" fill="#000" />
                    </mask>
                  </defs>
                  <rect width="100" height="100" fill="#11160f99" mask={`url(#${maskId})`} />
                  <ellipse
                    className="security-oval-ring"
                    cx="50"
                    cy="50"
                    rx="23"
                    ry="36"
                    fill="none"
                    strokeDasharray="2.6 2.2"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <span className={`security-liveness-status${aligned ? " is-aligned" : ""}`} aria-live="polite">
                  {livenessCopy}
                </span>
                {liveness === "countdown" && (
                  <span className="security-countdown" aria-hidden="true">{countdown}</span>
                )}
                <span className="security-live-dot">Camera on · checking presence in this browser</span>
              </div>

              {fallbackAvailable && liveness !== "countdown" && (
                <p className="security-fallback-note" role="status">
                  {faceCheckFailed
                    ? "The on-device face check could not start or is unavailable on this browser."
                    : "No blink detected yet."}
                  {" "}You can take a single photo manually instead.
                </p>
              )}
            </>
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
                {info.required ? signOutForm : <button type="button" className="security-skip" onClick={dismiss}>Not now</button>}
              </>
            )}
            {status === "camera" && (
              <>
                {fallbackAvailable && liveness !== "countdown" && (
                  <button type="button" className="security-fallback-button" onClick={() => captureFrame("manual_fallback")}>
                    <Camera size={15} /> Take photo manually
                  </button>
                )}
                <button type="button" className="security-skip" onClick={() => { stopDetection(); stopCamera(); setStatus("idle"); }}>Cancel</button>
                {info.required ? signOutForm : null}
              </>
            )}
            {status === "review" && (
              <>
                <button type="button" className="security-primary" disabled={!consent} onClick={sendVerification}>Send verification <ArrowRight size={15} /></button>
                <button type="button" className="security-skip" onClick={() => { setPhoto(null); setStatus("idle"); startCamera(); }}>Retake</button>
                {info.required ? signOutForm : <button type="button" className="security-skip" onClick={dismiss}>Not now</button>}
              </>
            )}
            {status === "sending" && (
              <button type="button" className="security-primary" disabled><Loader2 size={15} className="spin-icon" /> Sending…</button>
            )}
          </div>
        </>
      )}

      <p className="security-footer">
        {info.required && (
          <>
            <Link href="/security">How this works &amp; alternative checks</Link>
            <span>·</span>
          </>
        )}
        {!info.required && (
          <>
            <Link href="/security">Manage verification history</Link>
            <span>·</span>
          </>
        )}
        <span>Photos are never captured in the background.</span>
      </p>
    </div>
  );

  if (mode === "page") return <div className="security-page-flow">{card}</div>;
  return <div className="security-overlay">{card}</div>;
}
