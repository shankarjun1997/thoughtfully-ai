import { describe, expect, it } from "vitest";
import { analyzeLocally, parseShoppingLines } from "../lib/analyzer";

describe("parseShoppingLines", () => {
  it("parses prices with rupee symbol and em dash", () => {
    expect(parseShoppingLines("Flowers — ₹150\nCoconut - Rs. 60")).toEqual([{ name: "Flowers", price: 150 }, { name: "Coconut", price: 60 }]);
  });
  it("keeps unknown prices unset", () => { expect(parseShoppingLines("Flowers")).toEqual([{ name: "Flowers" }]); });
  it("ignores blank lines", () => { expect(parseShoppingLines("\nFlowers\n  ")).toEqual([{ name: "Flowers" }]); });
});

describe("analyzeLocally", () => {
  it("flags repeated items without claiming ordinary items are unnecessary", () => {
    const result = analyzeLocally("Flowers — ₹150\nFlowers — ₹150\nCoconut — ₹60", 500, "pooja");
    expect(result.recommendations.filter((item) => item.action === "remove")).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("keep");
    expect(result.mode).toBe("rules");
  });
  it("calculates a total only when every item has a price", () => {
    expect(analyzeLocally("Flowers — ₹150\nCoconut", 500, "general").totalEstimated).toBeNull();
    expect(analyzeLocally("Flowers — ₹150\nCoconut — ₹60", 500, "general").totalEstimated).toBe(210);
  });
  it("reports when a priced list exceeds budget", () => {
    expect(analyzeLocally("Flowers — ₹150\nCoconut — ₹60", 100, "general").budgetStatus).toContain("over budget");
  });
});
