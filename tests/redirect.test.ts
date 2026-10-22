import { describe, expect, it } from "vitest";
import { safeNextPath } from "../lib/auth/redirect";

describe("safeNextPath", () => {
  it("allows local paths", () => {
    expect(safeNextPath("/calendar?view=month")).toBe("/calendar?view=month");
  });

  it("rejects external and protocol-relative paths", () => {
    expect(safeNextPath("https://evil.example")).toBe("/app");
    expect(safeNextPath("//evil.example")).toBe("/app");
    expect(safeNextPath(null)).toBe("/app");
  });

  it("allows callers to choose a different fallback", () => {
    expect(safeNextPath(null, "/login")).toBe("/login");
  });
});
