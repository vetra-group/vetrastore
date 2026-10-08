import Image from "next/image";
import Link from "@/components/loading/NavigationLink";
import { ArrowDown, ArrowRight, ArrowUpRight, ChevronRight, Coffee, Flower2, Plus, Sandwich, Utensils } from "lucide-react";
import { honeyStory } from "@/content/honey";
import { commerce } from "@/content/commerce";
import { publicPaymentCopy } from "@/content/payment-checkout";
import { HONEY_ID, honey as defaultHoney } from "@/lib/catalog";
import { getLocalizedPublishedContent } from "@/lib/localized-content";
import type { CmsContent } from "@/lib/cms/types";
import { applyCopy } from "@/lib/cms/defaults";
import { localizedPath, type Locale } from "@/lib/i18n";
import HoneyPurchase from "./HoneyPurchase";
import HoneyGallery from "./HoneyGallery";
import HoneyPurchaseShortcut from "./HoneyPurchaseShortcut";
import { HoneyMarketPrice, HoneyMarketShipping } from "./HoneyMarketPrice";
import styles from "./HoneyExperience.module.css";

const servingIdeas = [
  { key: "toast", icon: Sandwich },
  { key: "yogurt", icon: Utensils },
  { key: "coffee", icon: Coffee },
] as const;

function BotanicalSprig({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 220 360" fill="none" aria-hidden="true" focusable="false">
      <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M105 350C96 266 145 170 139 31M105 312C67 283 44 251 35 212M115 246C155 212 176 182 189 135M134 160C104 132 87 97 78 59" />
        <path d="M111 292C143 251 183 273 170 295C155 317 130 315 111 292ZM119 249C78 250 48 229 54 207C82 200 112 218 119 249ZM131 204C153 159 185 162 187 185C190 209 162 219 131 204ZM138 127C105 124 91 102 97 82C122 86 141 104 138 127ZM140 87C165 50 191 55 185 77C178 96 159 100 140 87ZM139 50C120 34 121 12 135 5C151 18 154 34 139 50ZM65 266C38 268 11 250 14 231C34 227 58 244 65 266ZM165 185C155 156 164 128 186 123C196 143 180 173 165 185" />
        <path d="M112 292L162 287M118 249L64 215M132 204L178 183M139 127L105 92M141 87L177 66M63 263L22 238" opacity=".6" />
        <g transform="translate(108 172)">
          <path d="M0 0C-32-5-37-29-22-30C-10-32-2-12 0 0ZM0 0C-3-33 16-45 23-32C31-18 10-5 0 0ZM0 0C25-23 44-10 37 2C30 14 12 7 0 0ZM0 0C25 16 21 39 8 35C-7 30-2 10 0 0ZM0 0C-12 26-36 27-35 13C-33 0-12 1 0 0Z" />
          <circle r="5" />
        </g>
        <circle cx="141" cy="153" r="7" /><circle cx="153" cy="146" r="6" />
      </g>
    </svg>
  );
}

export default async function HoneyExperience({ locale, overrideContent, preview = false, paymentsEnabled = false }: { locale: Locale; overrideContent?: CmsContent; preview?: boolean; paymentsEnabled?: boolean }) {
  const content = overrideContent ?? await getLocalizedPublishedContent(locale);
  const honey = content.products.find((product) => product.id === HONEY_ID && product.status === "published");
  if (!honey) return null;
  const c = applyCopy(honeyStory[locale], `honey.${locale}`, content.copy);
  const t = applyCopy(commerce[locale], `commerce.${locale}`, content.copy);
  const href = (path: string) => localizedPath(locale, path);
  return (
    <div className={styles.experience} id="top">
      <main id="main-content">
        <nav className={styles.breadcrumbs} aria-label={t.breadcrumb}>
          <ol><li><Link href={href("")}>{t.home}</Link></li>
            <li><ChevronRight size="1rem" aria-hidden="true" /><Link href={href("/products")}>{t.products}</Link></li>
            <li><ChevronRight size="1rem" aria-hidden="true" /><span aria-current="page">{honey.name[locale]}</span></li>
          </ol>
        </nav>
        <section className={styles.hero} aria-labelledby="honey-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{c.eyebrow}</p>
            <h1 id="honey-title"><span>{content.copy[`honey.${locale}.title.0`] ?? (honey.name[locale] === defaultHoney.name[locale] ? c.title[0] : honey.name[locale])}</span><em>{c.title[1]}</em></h1>
            <p className={styles.heroIntro}>{c.intro}</p>
            <div className={styles.heroOffer}>
              <p>{honey.weight} {t.gram}<span aria-hidden="true">·</span><strong><HoneyMarketPrice product={honey} locale={locale} /></strong></p>
              <span><HoneyMarketShipping locale={locale} /></span>
            </div>
            <div className={styles.heroActions}>
              <a href="#shop" className={styles.primaryLink}>{c.discover}<ChevronRight size="1.1875rem" aria-hidden="true" /></a>
              <a href="#origin" className={styles.storyLink}>{c.storyLink}<ArrowDown size="1.125rem" aria-hidden="true" /></a>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.sunDisc} />
            <BotanicalSprig className={styles.botanicalLeft} />
            <BotanicalSprig className={styles.botanicalRight} />
            <div className={styles.productHalo} />
            <Image src={honey.image} alt={honey.card[locale].imageAlt} width={1100} height={1000} loading="eager" fetchPriority="high" sizes="(max-width: 48rem) 75vw, (max-width: 100rem) 38vw, 34rem" className={styles.heroJar} />
            <div className={styles.seal}><strong>100%</strong><span>{c.pure}</span></div>
          </div>
        </section>

        <section className={styles.factStrip} aria-label={t.details}>
          <div><span>100%</span><p>{c.ingredient}</p></div>
          <div><span>{honey.weight} {t.gram}</span><p>{c.netWeight}</p></div>
          <div><span>{c.origin}</span><p>{c.originLabel}</p></div>
        </section>

        <section className={styles.origin} id="origin" aria-labelledby="origin-title">
          <figure className={styles.landscape}>
            <div className={styles.landscapeImage}><Image src="/images/nature-story.webp" alt={c.landscapeAlt} fill sizes="(max-width: 48rem) 90vw, (max-width: 120rem) 45vw, 56rem" /></div>
            <figcaption>{c.landscapeCaption}</figcaption>
          </figure>
          <div className={styles.originCopy}>
            <p className={styles.eyebrow}>{c.originEyebrow}</p>
            <h2 id="origin-title">{c.originTitle}</h2>
            <p>{c.originBody}</p>
            <div className={styles.originNote}><Flower2 size="1.875rem" strokeWidth={1} aria-hidden="true" /><p>{c.originNote}</p></div>
            <Link href={href("/blog/a-taste-of-coffee-blossom")} className={styles.textLink}>{c.originLink}<ArrowUpRight size="1.125rem" aria-hidden="true" /></Link>
          </div>
        </section>

        <section className={styles.rituals} id="rituals" aria-labelledby="rituals-title">
          <div className={styles.sectionIntro}><div><p className={styles.eyebrow}>{c.ritualEyebrow}</p><h2 id="rituals-title">{c.ritualTitle}</h2></div><p>{c.ritualIntro}</p></div>
          <div className={styles.ritualImage}><Image src="/images/hero-eshan-4.webp" alt={c.ritualAlt} fill sizes="(min-width: 120em) 120rem, 100vw" /></div>
          <div className={styles.ritualGrid}>
            {servingIdeas.map(({ key, icon: ServingIcon }) => (
              <article key={key}>
                <span className={styles.servingIcon}><ServingIcon size="1.5rem" strokeWidth={1.5} aria-hidden="true" /></span>
                <h3>{c.rituals[key].title}</h3>
                <p>{c.rituals[key].body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.shop} id="shop" aria-labelledby="shop-title">
          <div className={styles.shopGallery}>
            <HoneyGallery labels={c.gallery} productSrc={honey.image} productAlt={honey.card[locale].imageAlt} lifestyleAlt={c.ritualAlt} images={honey.gallery?.map((image) => ({ key: image.id, src: image.src, alt: image.alt[locale], label: image.caption?.[locale] || image.alt[locale], kind: image.id === "lifestyle" ? "lifestyle" : image.id === "product" ? "product" : "label" }))} />
            <p className={styles.labelNote}>{c.labelNote}</p>
          </div>
          <div className={styles.shopCopy} id="honey-purchase" tabIndex={-1}>
            <p className={styles.eyebrow}>{c.shopEyebrow}</p>
            <h2 id="shop-title">{content.copy[`honey.${locale}.shopTitle`] ?? (honey.name[locale] === defaultHoney.name[locale] && honey.brand === defaultHoney.brand ? c.shopTitle : `${honey.brand} ${honey.name[locale]}`)}</h2>
            <p>{honey.description[locale]}</p>
            <p className={styles.productMeta}>{honey.weight} {t.gram} · {t.oneJar}</p>
            <p className={styles.price}><HoneyMarketPrice product={honey} locale={locale} /><span><HoneyMarketShipping locale={locale} /></span></p>
            <HoneyPurchase locale={locale} preview={preview} paymentsEnabled={paymentsEnabled} />
          </div>
        </section>

        <section className={styles.faq} aria-labelledby="faq-title">
          <div><p className={styles.eyebrow}>{c.faqEyebrow}</p><h2 id="faq-title">{c.faqTitle}</h2><p>{c.faqIntro}</p><Link className={styles.textLink} href={href("/contact")}>{t.contact}<ArrowRight size="1.125rem" aria-hidden="true" /></Link></div>
          <div className={styles.questions}>{Object.entries(c.faqs).map(([key, faq]) => <details key={key}><summary>{faq.question}<Plus size="1.25rem" aria-hidden="true" /></summary><p>{paymentsEnabled && !preview && key === "delivery" ? publicPaymentCopy[locale].honeyFaq : faq.answer}</p></details>)}</div>
        </section>
      </main>
      {!preview && <HoneyPurchaseShortcut locale={locale} label={c.chooseProduct} />}
    </div>
  );
}
