export type ShoppingItem = { id: string; name: string; price?: number; quantity?: string; category?: string; checked: boolean };
export type PlannerEvent = { id: string; title: string; date: string; category: string; notes?: string; checklist?: ShoppingItem[] };
export type Recommendation = { item: string; action: "keep" | "consider" | "remove" | "add"; reason: string; estimatedPrice?: number };
export type ListAnalysis = { summary: string; totalEstimated: number | null; budgetStatus: string; recommendations: Recommendation[]; missingEssentials: string[]; savingsTips: string[]; caveats: string[]; mode: "ai" | "rules" };
