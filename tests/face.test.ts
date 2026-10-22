import { describe, expect, it } from "vitest";
import {
  blinkScores,
  detectBlink,
  evaluateFaceAlignment,
  faceBoxFromLandmarks,
  type BlendShapeGroup,
  type FaceBox,
} from "../lib/security/face";

function box(overrides: Partial<FaceBox> = {}): FaceBox {
  return { x: 0, y: 0, width: 0, height: 0, cx: 0, cy: 0, coverage: 0, ...overrides };
}

function blendshapes(values: Record<string, number>): BlendShapeGroup[] {
  return [{
    categories: Object.entries(values).map(([categoryName, score], index) => ({
      categoryName,
      score,
      index,
      displayName: "",
    })),
  }];
}

describe("faceBoxFromLandmarks", () => {
  it("converts normalized landmarks into pixel bounds and coverage", () => {
    const result = faceBoxFromLandmarks(
      [
        { x: 0.2, y: 0.2 },
        { x: 0.6, y: 0.2 },
        { x: 0.6, y: 0.6 },
        { x: 0.2, y: 0.6 },
      ],
      640,
      480,
    );

    expect(result.x).toBeCloseTo(128);
    expect(result.y).toBeCloseTo(96);
    expect(result.width).toBeCloseTo(256);
    expect(result.height).toBeCloseTo(192);
    expect(result.cx).toBeCloseTo(256);
    expect(result.cy).toBeCloseTo(192);
    expect(result.coverage).toBeCloseTo(0.4);
  });

  it("returns a zero box for empty or invalid input", () => {
    expect(faceBoxFromLandmarks([], 640, 480)).toEqual(box());
    expect(faceBoxFromLandmarks(null, 640, 480)).toEqual(box());
    expect(faceBoxFromLandmarks([{ x: 0.5, y: 0.5 }], 0, 480)).toEqual(box());
  });

  it("clamps landmarks that spill outside the frame", () => {
    const result = faceBoxFromLandmarks(
      [
        { x: -0.2, y: -0.1 },
        { x: 1.2, y: 1.1 },
      ],
      200,
      100,
    );

    expect(result).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      cx: 100,
      cy: 50,
      coverage: 1,
    });
  });
});

describe("evaluateFaceAlignment", () => {
  const frameWidth = 640;
  const frameHeight = 480;

  it("accepts a centred face covering 45% of the frame width", () => {
    const result = evaluateFaceAlignment(
      box({ x: 176, y: 132, width: 288, height: 216, cx: 320, cy: 240, coverage: 0.45 }),
      frameWidth,
      frameHeight,
    );
    expect(result).toEqual({ aligned: true, reason: "ok", coverage: 0.45 });
  });

  it("rejects a face that is too small", () => {
    const result = evaluateFaceAlignment(
      box({ x: 256, y: 192, width: 128, height: 96, cx: 320, cy: 240, coverage: 0.2 }),
      frameWidth,
      frameHeight,
    );
    expect(result).toEqual({ aligned: false, reason: "too-small", coverage: 0.2 });
  });

  it("rejects a face that is horizontally off-centre", () => {
    const result = evaluateFaceAlignment(
      box({ x: 336, y: 132, width: 288, height: 216, cx: 480, cy: 240, coverage: 0.45 }),
      frameWidth,
      frameHeight,
    );
    expect(result).toEqual({ aligned: false, reason: "off-center", coverage: 0.45 });
  });

  it("rejects a face that is vertically off-centre", () => {
    const result = evaluateFaceAlignment(
      box({ x: 176, y: 300, width: 288, height: 216, cx: 320, cy: 408, coverage: 0.45 }),
      frameWidth,
      frameHeight,
    );
    expect(result.aligned).toBe(false);
    expect(result.reason).toBe("off-center");
  });

  it("reports no-face for an empty box", () => {
    expect(evaluateFaceAlignment(box(), frameWidth, frameHeight)).toEqual({
      aligned: false,
      reason: "no-face",
      coverage: 0,
    });
  });
});

describe("detectBlink", () => {
  it("is true only when both eyes cross the threshold", () => {
    expect(detectBlink(blendshapes({ eyeBlinkLeft: 0.82, eyeBlinkRight: 0.74 }))).toBe(true);
    expect(detectBlink(blendshapes({ eyeBlinkLeft: 0.82, eyeBlinkRight: 0.2 }))).toBe(false);
    expect(detectBlink(blendshapes({ eyeBlinkLeft: 0.51, eyeBlinkRight: 0.49 }))).toBe(false);
  });

  it("supports a custom threshold and missing categories", () => {
    expect(detectBlink(blendshapes({ eyeBlinkLeft: 0.4, eyeBlinkRight: 0.35 }), 0.3)).toBe(true);
    expect(detectBlink(blendshapes({ eyeBlinkLeft: 0.9 }))).toBe(false);
    expect(detectBlink(null)).toBe(false);
    expect(detectBlink([])).toBe(false);
  });

  it("reads raw blink scores for arming the blink check", () => {
    expect(blinkScores(blendshapes({ eyeBlinkLeft: 0.72, eyeBlinkRight: 0.65 }))).toEqual({ left: 0.72, right: 0.65 });
    expect(blinkScores(undefined)).toEqual({ left: 0, right: 0 });
  });
});
