export const ITEM_CATEGORIES = [
  "Pooja & rituals",
  "Food & groceries",
  "Decor & flowers",
  "Gifts & return gifts",
  "Household & cleaning",
  "Clothing & accessories",
  "Equipment & rentals",
  "Venue & logistics",
  "Invites & printing",
  "Other",
] as const;

const CATEGORY_ORDER = new Map<string, number>(ITEM_CATEGORIES.map((category, index) => [category, index]));

export function categoryOf(item: { category?: string }) {
  const value = item.category?.trim();
  return value && value.length <= 60 ? value : "Other";
}

export function groupItemsByCategory<T extends { category?: string }>(items: T[]): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const category = categoryOf(item);
    const group = groups.get(category);
    if (group) group.push(item);
    else groups.set(category, [item]);
  }
  return [...groups.entries()].sort((a, b) => {
    const orderA = CATEGORY_ORDER.get(a[0]) ?? 50;
    const orderB = CATEGORY_ORDER.get(b[0]) ?? 50;
    return orderA - orderB || a[0].localeCompare(b[0]);
  });
}
