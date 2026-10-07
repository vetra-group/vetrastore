export function applyCopy<T>(source: T, prefix: string, overrides: Record<string, string>): T {
  if (typeof source === "string") return (overrides[prefix] ?? source) as T;
  if (Array.isArray(source)) return source.map((entry, index) => applyCopy(entry, `${prefix}.${index}`, overrides)) as T;
  if (source && typeof source === "object") return Object.fromEntries(Object.entries(source).map(([key, entry]) => [key, applyCopy(entry, `${prefix}.${key}`, overrides)])) as T;
  return source;
}
