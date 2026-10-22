/**
 * On-device face presence helpers.
 *
 * Nothing here recognises a person or produces a biometric template. Landmarks
 * are used for a few milliseconds to check that a face is roughly centred and
 * that the person blinked, then discarded with the video frame.
 *
 * The pure helpers stay free of DOM and MediaPipe so they can be unit tested
 * in Node. MediaPipe is loaded lazily by `loadFaceLandmarker()` only in the
 * browser, which keeps it out of the main bundle.
 */

export type FacePoint = { x: number; y: number };

export type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  coverage: number;
};

export type AlignmentReason = "no-face" | "too-small" | "off-center" | "ok";

export type FaceAlignment = {
  aligned: boolean;
  reason: AlignmentReason;
  coverage: number;
};

export type BlendShapeCategory = { categoryName: string; score: number };
export type BlendShapeGroup =
  | { categories: ReadonlyArray<BlendShapeCategory> }
  | ReadonlyArray<BlendShapeCategory>;
export type BlendShapeInput = ReadonlyArray<BlendShapeGroup> | null | undefined;

export type FaceLandmarkerFrame = {
  faceLandmarks: ReadonlyArray<ReadonlyArray<FacePoint>>;
  faceBlendshapes: ReadonlyArray<{ categories: ReadonlyArray<BlendShapeCategory> }>;
};

export type FaceLandmarkerHandle = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => FaceLandmarkerFrame;
  close?: () => void;
};

/** Package version pinned in package.json — keep the CDN path in lockstep. */
export const MEDIAPIPE_TASKS_VISION_VERSION = "1.1.1";
export const FACE_LANDMARKER_WASM_PATH =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}/wasm`;
export const FACE_LANDMARKER_MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export const MIN_FACE_WIDTH_RATIO = 0.28;
export const MAX_FACE_WIDTH_RATIO = 0.7;
export const MAX_CENTER_OFFSET_RATIO = 0.12;

const EMPTY_BOX: FaceBox = { x: 0, y: 0, width: 0, height: 0, cx: 0, cy: 0, coverage: 0 };

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/**
 * Bounding box of the detected face landmarks in video pixels.
 * `coverage` is the face width as a fraction of the frame width.
 * MediaPipe landmarks are normalized, so empty input yields a zero box.
 */
export function faceBoxFromLandmarks(
  landmarks: ReadonlyArray<FacePoint> | null | undefined,
  frameWidth: number,
  frameHeight: number,
): FaceBox {
  if (!landmarks?.length || !Number.isFinite(frameWidth) || !Number.isFinite(frameHeight) || frameWidth <= 0 || frameHeight <= 0) {
    return { ...EMPTY_BOX };
  }

  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  let found = false;

  for (const landmark of landmarks) {
    const x = Number(landmark?.x);
    const y = Number(landmark?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    found = true;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  if (!found) return { ...EMPTY_BOX };

  const left = clamp01(minX);
  const right = clamp01(maxX);
  const top = clamp01(minY);
  const bottom = clamp01(maxY);
  const width = Math.max(0, right - left) * frameWidth;
  const height = Math.max(0, bottom - top) * frameHeight;
  const x = left * frameWidth;
  const y = top * frameHeight;

  return {
    x,
    y,
    width,
    height,
    cx: x + width / 2,
    cy: y + height / 2,
    coverage: width / frameWidth,
  };
}

/**
 * A face is usable when it covers 28–70% of the frame width and its centre is
 * within 12% of the frame centre on both axes.
 */
export function evaluateFaceAlignment(box: FaceBox, frameWidth: number, frameHeight: number): FaceAlignment {
  if (!box || !Number.isFinite(frameWidth) || !Number.isFinite(frameHeight) || frameWidth <= 0 || frameHeight <= 0 || !(box.width > 0) || !(box.height > 0)) {
    return { aligned: false, reason: "no-face", coverage: 0 };
  }

  const coverage = Number.isFinite(box.coverage) ? box.coverage : box.width / frameWidth;
  if (coverage < MIN_FACE_WIDTH_RATIO || coverage > MAX_FACE_WIDTH_RATIO) {
    return { aligned: false, reason: "too-small", coverage };
  }

  const offsetX = Math.abs(box.cx / frameWidth - 0.5);
  const offsetY = Math.abs(box.cy / frameHeight - 0.5);
  if (offsetX > MAX_CENTER_OFFSET_RATIO || offsetY > MAX_CENTER_OFFSET_RATIO) {
    return { aligned: false, reason: "off-center", coverage };
  }

  return { aligned: true, reason: "ok", coverage };
}

function blendShapeCategories(group: BlendShapeGroup): ReadonlyArray<BlendShapeCategory> {
  if (Array.isArray(group)) return group as ReadonlyArray<BlendShapeCategory>;
  const wrapped = group as { categories?: ReadonlyArray<BlendShapeCategory> };
  return wrapped.categories ?? [];
}

/** Reads the two blink blendshape scores; missing categories count as 0. */
export function blinkScores(blendshapes: BlendShapeInput): { left: number; right: number } {
  const scores = new Map<string, number>();

  for (const group of blendshapes ?? []) {
    for (const category of blendShapeCategories(group)) {
      if (!category?.categoryName) continue;
      const score = Number(category.score);
      if (Number.isFinite(score)) scores.set(category.categoryName, score);
    }
  }

  return {
    left: scores.get("eyeBlinkLeft") ?? 0,
    right: scores.get("eyeBlinkRight") ?? 0,
  };
}

/** True when both eyes are closed at the same time. */
export function detectBlink(blendshapes: BlendShapeInput, threshold = 0.5): boolean {
  const scores = blinkScores(blendshapes);
  return scores.left >= threshold && scores.right >= threshold;
}

let landmarkerPromise: Promise<FaceLandmarkerHandle> | null = null;

/**
 * Loads MediaPipe FaceLandmarker on demand. The instance is cached for the
 * lifetime of the page; if loading fails the cache resets so a retry works.
 */
export function loadFaceLandmarker(): Promise<FaceLandmarkerHandle> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Face detection is only available in the browser."));
  }
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(FACE_LANDMARKER_WASM_PATH);
      const landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_PATH },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
      });
      return landmarker as unknown as FaceLandmarkerHandle;
    })().catch((error) => {
      landmarkerPromise = null;
      throw error;
    });
  }
  return landmarkerPromise;
}
