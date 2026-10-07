import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/Icon";
import { storyCopy } from "@/content/pages";
import { applyCopy } from "@/lib/cms/defaults";
import { getLocalizedPublishedContent } from "@/lib/localized-content";
import { localizedPath, type Locale } from "@/lib/i18n";
import { organizationSchema, pageSchema, serializeSchema } from "@/lib/structured-data";
import styles from "./AboutContent.module.css";

export default async function AboutContent({ locale }: { locale: Locale }) {
  const content = await getLocalizedPublishedContent(locale);
  // Retain the existing CMS namespace so saved copy and backups stay compatible.
  const c = applyCopy(storyCopy[locale], `pages.story.${locale}`, content.copy);
  const href = (path: string) => localizedPath(locale, path);
  const principles = [
    { key: "knowledge", icon: "productSearch" as const, ...c.values[0] },
    { key: "quality", icon: "shield" as const, ...c.values[1] },
    { key: "value", icon: "heart" as const, ...c.values[2] },
  ];
  const schema = {
    ...pageSchema(locale, "/about", c.title, "AboutPage"),
    description: c.description,
    about: organizationSchema(content.settings, locale),
  };

  return (
    <div className={styles.page}>
      <section className={`container ${styles.hero}`} aria-labelledby="about-title">
        <div className={styles.heroCopy}>
          <p className={`eyebrow ${styles.eyebrow}`}>{c.eyebrow}</p>
          <h1 id="about-title">
            {c.hero.split("\n").map((line, index) => <span key={index}>{line}</span>)}
          </h1>
          <p className={styles.heroBody}>{c.body}</p>
          <div className={styles.heroActions}>
            <Link className="button" href={href("/products")}>{c.shop}<Icon name="chevron" /></Link>
            <a className={styles.quietLink} href="#selection-process">{c.processEyebrow}<Icon name="chevron" /></a>
          </div>
          <p className={styles.heroNote}>{c.subtitle}</p>
        </div>
        <figure className={styles.heroFigure}>
          <div className={styles.heroImage}>
            <Image src="/images/hero-honey-ritual.webp" alt={c.heroImageAlt} fill sizes="(max-width: 52rem) 94vw, (max-width: 120rem) 48vw, 56rem" loading="eager" fetchPriority="high" />
          </div>
          <figcaption><span className={styles.captionRule} aria-hidden="true" />{c.imageCaption}</figcaption>
        </figure>
      </section>

      <section className={`container ${styles.principles}`} id="selection-principles" aria-labelledby="principles-title">
        <header className={styles.sectionHead}>
          <p className={`eyebrow ${styles.eyebrow}`}>{c.principlesEyebrow}</p>
          <h2 id="principles-title">{c.principlesTitle}</h2>
          <p>{c.principlesIntro}</p>
        </header>
        <div className={styles.principleGrid}>
          {principles.map((item) => (
            <article className={styles.principle} key={item.key}>
              <span className={styles.principleIcon}><Icon name={item.icon} /></span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`container ${styles.process}`} id="selection-process" aria-labelledby="process-title">
        <figure className={styles.processFigure}>
          <div className={styles.processImage}>
            <Image src="/images/nature-story.webp" alt="" fill sizes="(max-width: 52rem) 94vw, (max-width: 120rem) 44vw, 48rem" />
            <div className={styles.imageStatement}>
              <p className="eyebrow">{c.why}</p>
              <p>{c.heading}</p>
            </div>
          </div>
          <figcaption>{c.note}</figcaption>
        </figure>
        <div className={styles.processCopy}>
          <p className={`eyebrow ${styles.eyebrow}`}>{c.processEyebrow}</p>
          <h2 id="process-title">{c.processTitle}</h2>
          <p className={styles.intro}>{c.processIntro}</p>
          <ol className={styles.steps} role="list">
            {c.processSteps.map((step, index) => (
              <li key={index}>
                <span className={styles.stepMark} aria-hidden="true"><Icon name="check" /></span>
                <div><h3>{step.title}</h3><p>{step.text}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={`container ${styles.service}`} id="personal-service" aria-labelledby="service-title">
        <div className={styles.serviceLead}>
          <p className="eyebrow">{c.serviceEyebrow}</p>
          <h2 id="service-title">{c.serviceTitle}</h2>
          <p>{c.serviceIntro}</p>
          <Link className={`textLink ${styles.serviceLink}`} href={href("/contact")}>{c.contact}<Icon name="chevron" /></Link>
        </div>
        <div className={styles.serviceDetails}>
          {c.services.map((item, index) => (
            <article className={styles.serviceItem} key={index}>
              <Icon name={index === 0 ? "bag" : "stock"} />
              <div><h3>{item.title}</h3><p>{item.text}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className={`container ${styles.closing}`} aria-labelledby="closing-title">
        <p className={`eyebrow ${styles.eyebrow}`}>{c.closingEyebrow}</p>
        <h2 id="closing-title">{c.closingTitle}</h2>
        <p>{c.closingBody}</p>
        <Link className="button" href={href("/products")}>{c.shop}<Icon name="chevron" /></Link>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeSchema(schema) }} />
    </div>
  );
}
