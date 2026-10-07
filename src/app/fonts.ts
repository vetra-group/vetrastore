import localFont from "next/font/local";

// Vendored OFL fonts keep the existing typefaces and make builds independent
// of the font provider. Thai files are loaded only for matching glyphs.
export const bodyLatin = localFont({ src: "./fonts/dm-sans-latin.woff2", weight: "400 700", style: "normal", display: "swap", variable: "--font-latin", adjustFontFallback: false });
export const bodyThai = localFont({ src: "./fonts/noto-sans-thai.woff2", weight: "400 700", style: "normal", display: "swap", variable: "--font-thai", preload: false, adjustFontFallback: false });
export const headingThai = localFont({ src: "./fonts/noto-serif-thai.woff2", weight: "400 600", style: "normal", display: "swap", variable: "--font-thai-heading", preload: false, adjustFontFallback: false });
export const bodyArabic = localFont({ src: "./fonts/noto-sans-arabic.woff2", weight: "400 700", style: "normal", display: "swap", variable: "--font-arabic", preload: false, adjustFontFallback: false });
export const headingArabic = localFont({ src: "./fonts/noto-naskh-arabic.woff2", weight: "400 600", style: "normal", display: "swap", variable: "--font-arabic-heading", preload: false, adjustFontFallback: false });
