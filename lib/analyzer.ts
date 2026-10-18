import type { ListAnalysis, Recommendation } from "./types";

export function parseShoppingLines(input: string): Array<{ name: string; price?: number }> {
  return input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = line.match(/(?:₹|Rs\.?\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:INR|rupees?)?\s*$/i);
    if (!match) return { name: line.replace(/^[-*•✓☐]\s*/, "").trim() };
    const price = Number(match[1].replace(/,/g, ""));
    const name = line.slice(0, match.index).replace(/[—–:-]\s*$/, "").trim();
    return name ? { name, price } : { name: line };
  });
}

export function analyzeLocally(input: string, budget: number, purpose: string): ListAnalysis {
  const parsed = parseShoppingLines(input);
  const seen = new Set<string>();
  const recommendations: Recommendation[] = parsed.map(({ name, price }) => {
    const key = name.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    if (seen.has(key)) return { item: name, action: "remove", reason: "Possible duplicate: confirm whether you need more than one.", estimatedPrice: price };
    seen.add(key);
    return { item: name, action: "keep", reason: "Review this item against the occasion and what you already have.", estimatedPrice: price };
  });
  const total = parsed.every((item) => typeof item.price === "number") && parsed.length > 0
    ? parsed.reduce((sum, item) => sum + (item.price ?? 0), 0) : null;
  const duplicateCount = recommendations.filter((item) => item.action === "remove").length;
  const budgetStatus = total === null ? "Add a price for each item to calculate the total." : total > budget ? `Estimated list is ₹${Math.round(total - budget).toLocaleString("en-IN")} over budget.` : `Estimated list is ₹${Math.round(budget - total).toLocaleString("en-IN")} under budget.`;
  return {
    summary: `Local rules preview for ${purpose || "your plan"}: ${parsed.length} item(s) reviewed${duplicateCount ? `, including ${duplicateCount} possible duplicate(s)` : ""}. This is not an AI assessment.`,
    totalEstimated: total, budgetStatus, recommendations, missingEssentials: [],
    savingsTips: ["Check what you already own before buying.", "Compare unit prices and avoid buying in bulk unless you will use it."],
    caveats: ["Rules-only preview: configure OPENAI_API_KEY to enable contextual AI recommendations.", "No item is marked unnecessary solely from its name; verify ritual requirements and personal needs."], mode: "rules"
  };
}
