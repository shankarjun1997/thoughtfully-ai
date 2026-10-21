import { describe, expect, it } from "vitest";
import { holidays, holidaysByDate, holidaysForMonth } from "../lib/holidays";

describe("holiday data", () => {
  it("uses ISO dates and stays sorted", () => {
    expect(holidays.length).toBeGreaterThan(100);
    for (const holiday of holidays) expect(holiday.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
    expect(holidays.map((holiday) => holiday.date)).toEqual(sorted.map((holiday) => holiday.date));
  });

  it("includes major national and festival dates", () => {
    expect(holidaysByDate["2026-01-26"]?.some((holiday) => holiday.name === "Republic Day")).toBe(true);
    expect(holidaysByDate["2026-11-08"]?.some((holiday) => holiday.name === "Diwali/Deepavali")).toBe(true);
    expect(holidaysByDate["2027-08-15"]?.some((holiday) => holiday.type === "national")).toBe(true);
  });

  it("filters by month", () => {
    const october = holidaysForMonth(2026, 9);
    expect(october.length).toBeGreaterThan(0);
    for (const holiday of october) expect(holiday.date.startsWith("2026-10")).toBe(true);
  });
});
