import { displayCurrencies } from "@/lib/catalog";

const ECB_DAILY = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const OPEN_DAILY = "https://open.er-api.com/v6/latest/THB";
type Rate = { rate: number; date: string; source: "ECB" | "ExchangeRate-API" };

function recentDate(date: string) {
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(timestamp)
    && timestamp <= Date.now() && Date.now() - timestamp <= 5 * 24 * 60 * 60 * 1000;
}

function validRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 1_000_000;
}

async function ecbRates(): Promise<Record<string, Rate>> {
  const response = await fetch(ECB_DAILY, { next: { revalidate: 12 * 60 * 60 }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("ECB unavailable");
  const xml = await response.text();
  if (xml.length > 20_000) throw new Error("Unexpected ECB payload");
  const date = xml.match(/<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1];
  if (!date || !recentDate(date)) throw new Error("Stale ECB rates");
  const perEuro: Record<string, number> = { EUR: 1 };
  for (const match of xml.matchAll(/<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]\s*\/>/g)) {
    const value = Number(match[2]);
    if (validRate(value)) perEuro[match[1]] = value;
  }
  if (!validRate(perEuro.THB)) throw new Error("Missing ECB THB rate");
  return Object.fromEntries(displayCurrencies.filter((currency) => validRate(perEuro[currency])).map((currency) => [
    currency, { rate: perEuro[currency] / perEuro.THB, date, source: "ECB" },
  ]));
}

async function openRates(): Promise<Record<string, Rate>> {
  const response = await fetch(OPEN_DAILY, { next: { revalidate: 24 * 60 * 60 }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("Open rates unavailable");
  const body = await response.text();
  if (body.length > 30_000) throw new Error("Unexpected open rate payload");
  const data: unknown = JSON.parse(body);
  if (!data || typeof data !== "object") throw new Error("Invalid open rates");
  const result = data as { result?: unknown; base_code?: unknown; time_last_update_unix?: unknown; rates?: unknown };
  const updated = typeof result.time_last_update_unix === "number" ? new Date(result.time_last_update_unix * 1000) : null;
  const date = updated && Number.isFinite(updated.getTime()) ? updated.toISOString().slice(0, 10) : "";
  if (result.result !== "success" || result.base_code !== "THB" || !recentDate(date) || !result.rates || typeof result.rates !== "object") throw new Error("Invalid open rate metadata");
  const rates = result.rates as Record<string, unknown>;
  if (typeof rates.THB !== "number" || Math.abs(rates.THB - 1) > 0.000001) throw new Error("Invalid open rate base");
  return Object.fromEntries(displayCurrencies.filter((currency) => validRate(rates[currency])).map((currency) => [
    currency, { rate: rates[currency] as number, date, source: "ExchangeRate-API" },
  ]));
}

export async function GET() {
  const [ecb, open] = await Promise.allSettled([ecbRates(), openRates()]);
  const rates = {
    ...(open.status === "fulfilled" ? open.value : {}),
    ...(ecb.status === "fulfilled" ? ecb.value : {}),
  };
  if (!Object.keys(rates).length) return Response.json({ error: "Currency estimates are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return Response.json({ rates }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
