import { describe, expect, it } from "vitest";
import { categoryOf, groupItemsByCategory } from "../lib/categories";

describe("category grouping", () => {
  it("falls back to Other and keeps known categories in display order", () => {
    const grouped = groupItemsByCategory([
      { name: "Flowers", category: "Decor & flowers" },
      { name: "Diyas", category: "Pooja & rituals" },
      { name: "Mystery", category: undefined },
      { name: "Sweets", category: "Food & groceries" },
    ]);
    expect(grouped.map(([category]) => category)).toEqual([
      "Pooja & rituals",
      "Food & groceries",
      "Decor & flowers",
      "Other",
    ]);
    expect(categoryOf({ category: "  " })).toBe("Other");
  });

  it("groups duplicate categories together", () => {
    const grouped = groupItemsByCategory([
      { name: "Roses", category: "Decor & flowers" },
      { name: "Marigold", category: "Decor & flowers" },
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0][1]).toHaveLength(2);
  });
});
