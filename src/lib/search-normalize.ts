/** Match Arabic with or without vocalisation and common alef variants. Keep
 * the original text for display, URLs and saved content. */
export function normalizeSearch(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en")
    .replace(/[\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي")
    .replace(/\s+/g, " ").trim();
}
