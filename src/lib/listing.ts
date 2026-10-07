export type ListingSearchParams = Record<string, string | string[] | undefined>;
export type PageSlice<T> = { items: T[]; total: number; page: number; pageCount: number; pageSize: number; start: number; end: number };

export function listingQuery(value: string | string[] | undefined, limit = 200) {
  return typeof value === "string" ? value.slice(0, limit).replace(/\s+/g, " ").trim() : "";
}

export function requestedPage(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 1;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : 1;
}

export function paginate<T>(items: T[], requested: number, pageSize = 12): PageSlice<T> {
  const size = Number.isSafeInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 48) : 12;
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(pageCount, Math.max(1, Number.isSafeInteger(requested) ? requested : 1));
  const offset = (page - 1) * size;
  return { items: items.slice(offset, offset + size), total: items.length, page, pageCount, pageSize: size, start: items.length ? offset + 1 : 0, end: Math.min(offset + size, items.length) };
}

/** New filter links omit page, so changing a filter always starts at page one. */
export function listingPath(path: string, filters: Record<string, string>, page = 1) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  if (page > 1) query.set("page", String(page));
  return `${path}${query.size ? `?${query.toString()}` : ""}`;
}

export function pageNeedsRedirect(value: string | string[] | undefined, page: number) {
  return value !== undefined && (typeof value !== "string" || value !== String(page));
}

/** Keep navigation bounded even when a library contains thousands of pages. */
export function pageLinks(page: number, pageCount: number): (number | "gap-before" | "gap-after")[] {
  const visible = [...new Set([1, pageCount, page - 1, page, page + 1])].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  const links: (number | "gap-before" | "gap-after")[] = [];
  visible.forEach((value, index) => {
    if (index && value - visible[index - 1] > 1) links.push(value <= page ? "gap-before" : "gap-after");
    links.push(value);
  });
  return links;
}
