export type DraftConflict = { path: string[]; mine: unknown; latest: unknown };

// Reference equality makes unchanged branches cheap during editing. Unlike
// JSON.stringify this does not allocate a copy of the entire content tree.
export function equalDraft(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && equalDraft(left[key], right[key]));
}

export function mergeDraft(base: unknown, mine: unknown, latest: unknown, conflicts: DraftConflict[] = [], path: string[] = [], choices: Record<string, "mine" | "latest"> = {}): unknown {
  if (equalDraft(mine, base)) return latest;
  if (equalDraft(latest, base) || equalDraft(mine, latest)) return mine;
  if (Array.isArray(base) && Array.isArray(mine) && Array.isArray(latest)) {
    const entries = [...base, ...mine, ...latest];
    const identity = ["id", "key", "slug"].find((key) => entries.length && entries.every((entry) => entry && typeof entry === "object" && typeof entry[key] === "string"));
    if (identity) {
      const map = (items: Record<string, unknown>[]) => new Map(items.map((entry) => [entry[identity] as string, entry]));
      const a = map(base), b = map(mine), c = map(latest);
      const baseOrder = base.map((entry) => entry[identity]);
      const mineOrder = mine.map((entry) => entry[identity]);
      const latestOrder = latest.map((entry) => entry[identity]);
      // Additions/deletions merge by identity. Competing reorders of existing
      // records require a choice, just like competing edits to a text field.
      const common = baseOrder.filter((key) => b.has(key) && c.has(key));
      const relative = (keys: string[]) => keys.filter((key) => common.includes(key));
      // Adding/removing an item is not a reorder of the remaining records.
      // Keep the other editor's order when ours did not change that order.
      let order: string[] = equalDraft(mineOrder, baseOrder) || (equalDraft(relative(mineOrder), common) && !equalDraft(relative(latestOrder), common)) ? latestOrder : mineOrder;
      if (!equalDraft(relative(mineOrder), common) && !equalDraft(relative(latestOrder), common) && !equalDraft(relative(mineOrder), relative(latestOrder))) {
        const orderPath = [...path, "order"];
        conflicts.push({ path: orderPath, mine: mineOrder, latest: latestOrder });
        if (choices[JSON.stringify(orderPath)] === "latest") order = latestOrder;
      }
      const keys = [...new Set([...order, ...latestOrder, ...mineOrder])];
      return keys.map((key) => mergeDraft(a.get(key), b.get(key), c.get(key), conflicts, [...path, key], choices)).filter((entry) => entry !== undefined);
    }
  }
  if (base && mine && latest && typeof base === "object" && typeof mine === "object" && typeof latest === "object" && !Array.isArray(base) && !Array.isArray(mine) && !Array.isArray(latest)) {
    const a = base as Record<string, unknown>, b = mine as Record<string, unknown>, c = latest as Record<string, unknown>;
    return Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b), ...Object.keys(c)])].map((key) => [key, mergeDraft(a[key], b[key], c[key], conflicts, [...path, key], choices)]).filter((entry) => entry[1] !== undefined));
  }
  conflicts.push({ path, mine, latest });
  return choices[JSON.stringify(path)] === "latest" ? latest : mine;
}
