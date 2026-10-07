import Link from "next/link";
import Icon from "@/components/Icon";
import ContactForm from "./ContactForm";
import Newsletter from "./Newsletter";
import { getLocalizedPublishedContent } from "@/lib/localized-content";
import { applyCopy } from "@/lib/cms/defaults";
import { storeDetails } from "@/content/store-details";
import { contactCopy, helpCopy, editorialUi } from "@/content/pages";
export { contactCopy, helpCopy } from "@/content/pages";
import { demoEnabled } from "@/lib/demo";
import { localizedPath, type Locale } from "@/lib/i18n";
import { HONEY_ID, formatPrice } from "@/lib/catalog";
import styles from "./Editorial.module.css";

export async function ContactContent({
  locale,
  initialSubject,
  initialWholesale,
}: {
  locale: Locale;
  initialSubject?: string;
  initialWholesale?: Partial<Record<"product" | "quantity" | "business" | "destination" | "neededBy", string>>;
}) {
  const content = await getLocalizedPublishedContent(locale);
  const c = applyCopy(contactCopy[locale], `pages.contact.${locale}`, content.copy);
  return (
    <div className={`container ${styles.editorialPage}`}>
      <header className={styles.pageHead}>
        <p className="eyebrow">{c.eyebrow}</p>
        <h1>{c.heading}</h1>
        <p>{c.intro}</p>
        {(content.settings.email || content.settings.phone || content.settings.address[locale]) && <address>
          {content.settings.email && <p><a href={`mailto:${content.settings.email}`}>{content.settings.email}</a></p>}
          {content.settings.phone && <p><a href={`tel:${content.settings.phone.replace(/[^+\d]/g, "")}`}>{content.settings.phone}</a></p>}
          {content.settings.address[locale] && <p>{content.settings.address[locale]}</p>}
        </address>}
      </header>
      <div className={styles.contactGrid}>
        <aside className={styles.contactAside}>
          <section>
            <span className={styles.contactIcon}>
              <Icon name="productSearch" size={23} />
            </span>
            <h2>{c.retail}</h2>
            <p>{c.retailBody}</p>
          </section>
          <section>
            <span className={styles.contactIcon}>
              <Icon name="stock" size={23} />
            </span>
            <h2>{c.wholesale}</h2>
            <p>{c.wholesaleBody}</p>
            <Link
              href={localizedPath(locale, "/contact?subject=wholesale")}
              className="textLink"
            >
              {c.wholesaleLink}
              <Icon name="chevron" size={17} />
            </Link>
          </section>
          <section>
            <span className={styles.contactIcon}>
              <Icon name="consultation" size={23} />
            </span>
            <h2>{c.help}</h2>
            <p>{c.helpBody}</p>
            <Link href={localizedPath(locale, "/help")} className="textLink">
              {c.helpLink}
              <Icon name="arrow" size={17} />
            </Link>
          </section>
        </aside>
        <ContactForm locale={locale} initialSubject={initialSubject} initialWholesale={initialWholesale} />
      </div>
      {demoEnabled && (
        <section className={styles.newsletterPreview} aria-labelledby="newsletter-preview-title">
          <div>
            <p className="eyebrow">{c.newsletterEyebrow}</p>
            <h2 id="newsletter-preview-title">{c.newsletterTitle}</h2>
          </div>
          <Newsletter locale={locale} />
        </section>
      )}
    </div>
  );
}

export async function HelpContent({ locale }: { locale: Locale }) {
  const content = await getLocalizedPublishedContent(locale);
  const c = applyCopy(helpCopy[locale], `pages.help.${locale}`, content.copy);
  const ui = applyCopy(editorialUi[locale], `pages.ui.${locale}`, content.copy);
  const details = applyCopy(storeDetails[locale], `store.${locale}`, content.copy);
  const honey = content.products.find((product) => product.id === HONEY_ID && product.status === "published");
  const questions = c.questions.map(([question, answer], index) => {
    if (index === 0 && !Object.hasOwn(content.copy, `pages.help.${locale}.questions.0.1`)) return [question, content.products.filter((product) => product.status === "published").map((product) => product.name[locale]).join(" · ") || (locale === "th" ? "กำลังปรับปรุงรายการสินค้า" : locale === "ar" ? "نعمل على تحديث قائمة المنتجات." : "Our catalog is being updated.")];
    if (index === 3 && honey && !Object.hasOwn(content.copy, `pages.help.${locale}.questions.3.1`)) return [question, `${honey.brand} ${honey.name[locale]} · ${honey.weight} ${locale === "th" ? "กรัม" : locale === "ar" ? "غ" : "g"} · ${formatPrice(honey.price, locale)}`];
    return [question, answer];
  });
  return (
    <div className={`container ${styles.editorialPage}`}>
      <header className={styles.pageHead}>
        <p className="eyebrow">{c.eyebrow}</p>
        <h1>{c.heading}</h1>
        <p>{c.intro}</p>
      </header>
      <div className={styles.helpGrid}>
        <nav
          className={styles.helpNav}
          aria-label={ui.helpTopics}
        >
          <a href="#faq">{c.faq}</a>
          <a href="#shipping">{c.shipping}</a>
          <a href="#returns">{c.returns}</a>
          <a href="#wholesale">{c.wholesale}</a>
          <a href="#privacy">{c.privacy}</a>
        </nav>
        <div className={styles.helpContent}>
          <section className={styles.helpSection} id="faq">
            <h2>{c.faq}</h2>
            {questions.map(([question, answer], index) => (
              <details className={styles.faq} key={index}>
                <summary>
                  {question}
                  <Icon name="plus" size={20} className={styles.faqPlus} />
                  <Icon name="minus" size={20} className={styles.faqMinus} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
            <Link
              className={`textLink ${styles.helpProductLink}`}
              href={localizedPath(locale, "/coffee-blossom-honey")}
            >
              {c.productLink}
              <Icon name="chevron" size={18} />
            </Link>
          </section>
          <section className={styles.helpSection} id="shipping">
            <h2>{c.shipping}</h2>
            <p>{content.copy[`pages.help.${locale}.shippingText`] ?? details.shipping.description}</p>
            <p>{content.copy[`pages.help.${locale}.shippingNote`] ?? details.stock.description}</p>
            <p>{details.batch.description}</p>
          </section>
          <section className={styles.helpSection} id="returns">
            <h2>{c.returns}</h2>
            <p>{content.copy[`pages.help.${locale}.returnsText`] ?? details.returns.description}</p>
          </section>
          <section className={styles.helpSection} id="wholesale">
            <h2>{c.wholesale}</h2>
            <p>{details.wholesale.description}</p>
            <Link
              className="textLink"
              href={localizedPath(locale, "/contact?subject=wholesale")}
            >
              {c.wholesaleLink}
              <Icon name="chevron" size={18} />
            </Link>
          </section>
          <section className={styles.helpSection} id="privacy">
            <h2>{c.privacy}</h2>
            <p>{c.privacyText}</p>
            <p>{c.privacyText2}</p>
          </section>
          {demoEnabled && (
            <section className={`${styles.helpSection} ${styles.demoNote}`}>
              <h2>{c.demoTitle}</h2>
              <p>{c.demoText}</p>
              <Link className="textLink" href={localizedPath(locale, "/staff")}>
                {c.demoLink}
                <Icon name="chevron" size={18} />
              </Link>
            </section>
          )}
          <div className={styles.helpNote}>
            <p>{c.note}</p>
            <p>
              <Link href={localizedPath(locale, "/contact")}>
                {c.contact}
                <Icon name="arrow" size={16} />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
