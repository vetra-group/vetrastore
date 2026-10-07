/* eslint-disable @next/next/no-img-element -- ImageResponse renders standard img elements; next/image is unavailable here. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { HONEY_ID } from "@/lib/catalog";
import { siteCopy } from "@/content/site";
import { storyCopy, journalCopy, contactCopy, helpCopy } from "@/content/pages";
import { applyCopy } from "@/lib/cms/defaults";
import { readCmsMedia } from "@/lib/cms/server";
import type { CmsContent } from "@/lib/cms/types";
import { validImageSource } from "@/lib/cms/validation";
import { getLocalizedPublishedContent } from "@/lib/localized-content";
import { isLocale, type Locale } from "@/lib/i18n";
import { socialImageSize } from "@/lib/social-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Card = { title: string; label: string; photo?: string; fit?: "cover" | "contain" };
type Context = { params: Promise<{ locale: string; path: string[] }> };

const labels = {
  en: { home: "THOUGHTFULLY SELECTED", products: "THE COLLECTION", about: "OUR STORY", blog: "THE JOURNAL", contact: "CONTACT", help: "HELP & INFORMATION", product: "PRODUCT" },
  ar: { home: "من اختيار VETRA", products: "المنتجات", about: "قصتنا", blog: "المجلة", contact: "تواصل معنا", help: "المساعدة والمعلومات", product: "المنتج" },
  th: { home: "คัดสรรโดย VETRA", products: "สินค้า", about: "เรื่องราวของเรา", blog: "บทความ", contact: "ติดต่อเรา", help: "ช่วยเหลือและข้อมูล", product: "สินค้า" },
} as const;

function cardFor(content: CmsContent, locale: Locale, parts: string[]): Card | null {
  const copy = content.copy;
  const label = labels[locale];
  const publishedProducts = content.products.filter((product) => product.status === "published");
  const publishedArticles = content.articles.filter((article) => article.status === "published");
  if (parts.length === 1) {
    switch (parts[0]) {
      case "home": {
        const c = applyCopy(siteCopy[locale], `site.${locale}`, copy);
        return { title: c.homeTitle, label: label.home };
      }
      case "products": {
        const c = applyCopy(siteCopy[locale], `site.${locale}`, copy);
        return { title: c.collectionTitle, label: label.products };
      }
      case "coffee-blossom-honey": {
        const honey = publishedProducts.find((product) => product.id === HONEY_ID);
        return honey ? { title: `${honey.brand} ${honey.name[locale]}`, label: label.product, photo: honey.image, fit: "contain" } : null;
      }
      case "about": {
        const c = applyCopy(storyCopy[locale], `pages.story.${locale}`, copy);
        return { title: c.hero, label: label.about, photo: "/images/hero-honey-ritual.webp" };
      }
      case "blog": {
        const c = applyCopy(journalCopy[locale], `pages.journal.${locale}`, copy);
        const featured = publishedArticles.find((article) => article.featured) ?? publishedArticles.find((article) => article.slug === "how-vetra-selects-products") ?? publishedArticles[0];
        return { title: c.title, label: label.blog, photo: featured?.image ?? "/images/nature-story.webp" };
      }
      case "contact": {
        const c = applyCopy(contactCopy[locale], `pages.contact.${locale}`, copy);
        return { title: c.title, label: label.contact, photo: "/images/nature-story.webp" };
      }
      case "help": {
        const c = applyCopy(helpCopy[locale], `pages.help.${locale}`, copy);
        return { title: c.title, label: label.help, photo: "/images/hero-honey-ritual.webp" };
      }
    }
  }
  if (parts.length === 2 && parts[0] === "blog") {
    const article = publishedArticles.find((item) => item.slug === parts[1]);
    return article ? {
      title: article.content[locale].title,
      label: article.content[locale].category || label.blog,
      photo: article.image,
      fit: /\/(?:honey-back\.jpg|honey-front\.jpg|honey-product\.png)$/.test(article.image.split("?")[0]) ? "contain" : "cover",
    } : null;
  }
  if (parts.length === 2 && parts[0] === "products") {
    const product = publishedProducts.find((item) => item.slug === parts[1] && item.id !== HONEY_ID);
    return product ? { title: `${product.brand} ${product.name[locale]}`, label: label.product, photo: product.image, fit: "contain" } : null;
  }
  return null;
}

const fileMime: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
const maxSourceBytes = 8 * 1024 * 1024;
async function photoDataUri(source: string | undefined, fit: "cover" | "contain" = "cover"): Promise<string | undefined> {
  if (!source) return undefined;
  try {
    validImageSource(source);
    let bytes: Uint8Array;
    let mime: string;
    if (source.startsWith("/images/")) {
      bytes = await readFile(path.join(process.cwd(), "public", source));
      mime = fileMime[source.split(".").at(-1)!.toLowerCase()];
    } else if (source.startsWith("/api/cms-media/")) {
      const media = await readCmsMedia(source.split("/").at(-1)!);
      if (!media?.published) return undefined;
      bytes = media.bytes;
      mime = media.mime;
    } else {
      const response = await fetch(source, { redirect: "error", signal: AbortSignal.timeout(5000) });
      if (!response.ok || Number(response.headers.get("content-length") ?? 0) > maxSourceBytes) return undefined;
      mime = response.headers.get("content-type")?.split(";")[0] ?? "";
      if (!Object.values(fileMime).includes(mime)) return undefined;
      if (!response.body) return undefined;
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxSourceBytes) { await reader.cancel(); return undefined; }
        chunks.push(value);
      }
      bytes = Buffer.concat(chunks, total);
    }
    if (bytes.byteLength > maxSourceBytes) return undefined;
    // Satori cannot decode WebP. A small JPEG/PNG also keeps each card fast to fetch.
    const image = sharp(Buffer.from(bytes)).rotate().resize(fit === "contain" ? 410 : 480, fit === "contain" ? 545 : 630, { fit: fit === "contain" ? "inside" : "cover" });
    const output = fit === "contain" ? await image.png().toBuffer() : await image.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    return `data:image/${fit === "contain" ? "png" : "jpeg"};base64,${output.toString("base64")}`;
  } catch {
    // A missing CMS/provider photo never turns the branded share card into a 500.
    return undefined;
  }
}

const asset = (name: string) => path.join(process.cwd(), "src", "app", "fonts", "og", name);
const fontFiles = { en: "dm-sans-latin.ttf", ar: "dm-sans-latin.ttf", th: "noto-sans-thai.ttf" } as const;
const fonts = new Map<Locale, Promise<Buffer>>();
function fontFor(locale: Locale) {
  if (!fonts.has(locale)) fonts.set(locale, readFile(asset(fontFiles[locale])));
  return fonts.get(locale)!;
}
const logo = readFile(path.join(process.cwd(), "public", "vetra-store-logo.svg"));

function escapeMarkup(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** Pango/HarfBuzz joins Arabic and wraps Thai at word boundaries within the card. */
async function shapedTextImage(value: string, color: string, fontSize: number, width: number, height: number, locale: "ar" | "th") {
  const rtl = locale === "ar";
  const text = await sharp({ text: {
    // Pango reverses left/right alignment for an RTL paragraph. The leading
    // mark also gives Latin-first brand names the Arabic card's base direction.
    text: `<span foreground="${color}">${rtl ? "\u200f" : ""}${escapeMarkup(value)}</span>`,
    font: `Noto Sans ${rtl ? "Arabic" : "Thai"} ${fontSize}`,
    fontfile: asset(rtl ? "noto-sans-arabic.ttf" : "noto-sans-thai.ttf"),
    width, align: "left", wrap: rtl ? "word-char" : "word", rgba: true, dpi: 72,
  } }).png().toBuffer();
  const rendered = await sharp(text).resize({ width, height, fit: "inside", withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
  const image = await sharp({ create: { width, height, channels: 4, background: "#00000000" } })
    .composite([{ input: rendered.data, left: rtl ? Math.max(0, width - rendered.info.width) : 0, top: 0 }])
    .png().toBuffer();
  return `data:image/png;base64,${image.toString("base64")}`;
}

export async function GET(_request: Request, { params }: Context) {
  const { locale: value, path: rawPath } = await params;
  if (!isLocale(value) || rawPath.length < 1 || rawPath.length > 2) return new Response(null, { status: 404 });
  const last = rawPath.at(-1)!;
  if (!last.endsWith(".png")) return new Response(null, { status: 404 });
  const parts = [...rawPath.slice(0, -1), last.slice(0, -4)];
  if (parts.some((part) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(part))) return new Response(null, { status: 404 });
  const locale = value;
  const card = cardFor(await getLocalizedPublishedContent(locale), locale, parts);
  if (!card) return new Response(null, { status: 404 });
  const [fontBytes, logoBytes, photo] = await Promise.all([fontFor(locale), logo, photoDataUri(card.photo, card.fit)]);
  const fontData = Uint8Array.from(fontBytes).buffer;
  const logoSrc = `data:image/svg+xml;base64,${logoBytes.toString("base64")}`;
  const rtl = locale === "ar";
  const title = card.title.replace(/\s+/g, " ").trim();
  const length = [...title].length;
  const visibleTitle = length > 112 ? `${[...title].slice(0, 109).join("").trimEnd()}…` : title;
  const titleSize = locale === "th"
    ? length > 70 ? 38 : length > 48 ? 43 : length > 35 ? 49 : 57
    : length > 85 ? 38 : length > 62 ? 43 : length > 42 ? 49 : 57;
  const [arabicLabel, arabicTitle] = rtl ? await Promise.all([
    shapedTextImage(card.label, "#e6c67f", 23, 586, 52, "ar"),
    shapedTextImage(visibleTitle, "#faf7f2", titleSize, 586, 250, "ar"),
  ]) : [undefined, undefined];
  const thaiTitle = locale === "th" ? await shapedTextImage(visibleTitle, "#faf7f2", titleSize, 586, 260, "th") : undefined;
  const panelLeft = rtl ? 480 : 0;
  const photoLeft = rtl ? 0 : 720;
  return new ImageResponse(
    <div style={{ position: "relative", display: "flex", width: "100%", height: "100%", backgroundColor: "#07162f", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: photoLeft, top: 0, width: 480, height: 630, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f0e8dc", overflow: "hidden" }}>
        {card.fit === "contain" && <div style={{ position: "absolute", width: 390, height: 390, borderRadius: 195, backgroundColor: "#e8d6b8", display: "flex" }} />}
        {photo && <img src={photo} alt="" style={{ width: card.fit === "contain" ? 410 : 480, height: card.fit === "contain" ? 545 : 630, objectFit: card.fit ?? "cover", objectPosition: "center" }} />}
        {!photo && <div style={{ position: "relative", width: 356, height: 356, border: "1px solid #c6a56a", borderRadius: 178, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#faf7f2" }}>
          <div style={{ position: "absolute", width: 324, height: 324, border: "1px solid #ded2c1", borderRadius: 162, display: "flex" }} />
          <img src={logoSrc} alt="" style={{ width: 254, height: 102, objectFit: "contain" }} />
        </div>}
      </div>
      <div style={{ position: "absolute", left: panelLeft, top: 0, width: 720, height: 630, display: "flex", flexDirection: "column", alignItems: rtl ? "flex-end" : "flex-start", padding: "55px 67px 48px", textAlign: rtl ? "right" : "left", direction: rtl ? "rtl" : "ltr" }}>
        <div style={{ width: 202, height: 87, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#faf7f2" }}>
          <img src={logoSrc} alt="" style={{ width: 166, height: 66, objectFit: "contain" }} />
        </div>
        {rtl ? <img src={arabicLabel} alt="" style={{ width: 586, height: 52, marginTop: 42 }} /> : <div style={{ display: "flex", marginTop: 42, color: "#e6c67f", fontSize: 23, letterSpacing: locale === "en" ? 3 : 0, lineHeight: 1.5, fontFamily: "Vetra Card" }}>{card.label}</div>}
        {rtl ? <img src={arabicTitle} alt="" style={{ width: 586, height: 250, marginTop: 16 }} /> : thaiTitle ? <img src={thaiTitle} alt="" style={{ width: 586, height: 260, marginTop: 16 }} /> : <div style={{ display: "flex", width: 586, marginTop: 16, maxHeight: 330, overflow: "hidden", color: "#faf7f2", fontSize: titleSize, lineHeight: 1.17, fontFamily: "Vetra Card", fontWeight: 600 }}>{visibleTitle}</div>}
        <div style={{ display: "flex", marginTop: "auto", width: 72, height: 3, backgroundColor: "#e6c67f" }} />
        <div style={{ display: "flex", marginTop: 18, color: "#ded2c1", fontSize: 22, letterSpacing: 1, fontFamily: "Vetra Card" }}>vetrastore.asia</div>
      </div>
      <div style={{ position: "absolute", left: rtl ? 478 : 718, top: 0, width: 2, height: 630, display: "flex", backgroundColor: "#bd9349" }} />
    </div>,
    { ...socialImageSize, fonts: [{ name: "Vetra Card", data: fontData, weight: 600, style: "normal" }], headers: { "Cache-Control": "public, max-age=0, must-revalidate" } },
  );
}
