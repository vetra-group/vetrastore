import Image from "next/image";
import Link from "@/components/loading/NavigationLink";
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
              {content.settings.storeName === "VETRA STORE" ? (
                <Image src="/vetra-store-logo.svg" alt="" width={1352} height={541} className={styles.brandImage} />
              ) : (
                <span className={styles.brandText}>{content.settings.storeName}</span>
              )}
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
          <a className={styles.rateCredit} href="https://www.exchangerate-api.com" lang="en">Rates By Exchange Rate API</a>
        </div>
      </div>
    </footer>
  );
}
