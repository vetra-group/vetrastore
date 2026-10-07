import Link from "next/link";
import { localizedPath, type Locale } from "@/lib/i18n";
import { siteCopy } from "@/content/site";
import { footerNavigation } from "@/content/site-structure";
import styles from "./Footer.module.css";
import { getPublishedContent } from "@/lib/cms/server";
import { applyCopy } from "@/lib/cms/defaults";
export default async function Footer({ locale }: { locale: Locale }) {
  const content = await getPublishedContent();
  const c = applyCopy(siteCopy[locale], `site.${locale}`, content.copy);
  return (
    <footer className={styles.footer} id="store-footer">
      <div className={`container ${styles.inner}`}>
        <div className={styles.main}>
          <div className={styles.identity}>
            <Link href={localizedPath(locale)} className={styles.brand} aria-label={content.settings.storeName}>
              <span>{content.settings.storeName === "VETRA STORE" ? "VETRA" : content.settings.storeName}</span>
              {content.settings.storeName === "VETRA STORE" && <small>STORE</small>}
            </Link>
            <p>{c.bottom}</p>
          </div>
        </div>
        <div className={styles.lower}>
          <nav className={styles.nav} aria-label={c.footerNavLabel}>
            {footerNavigation.map(({ key, path }) => (
              <Link href={localizedPath(locale, path)} key={key}>
                {c.links[key]}
              </Link>
            ))}
          </nav>
          <p>{c.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
