import Image from "next/image";
import Link from "@/components/loading/NavigationLink";
import Icon from "@/components/Icon";
import ArticleCard from "./ArticleCard";
import { journalCopy } from "@/content/pages";
import type { JournalArticle } from "@/content/editorial";
import type { CmsContent } from "@/lib/cms/types";
import { articleCard } from "@/lib/blog";
import { getLocalizedPublishedContent } from "@/lib/localized-content";
import { applyCopy } from "@/lib/cms/defaults";
import { localizedPath, localizedContentHref, type Locale } from "@/lib/i18n";
import { absoluteUrl, breadcrumbSchema, organizationSchema, pageSchema, serializeSchema } from "@/lib/structured-data";
import styles from "./BlogArticle.module.css";

function Paragraphs({ text }: { text: string }) {
  return text.split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).map((paragraph, index) => <p key={index}>{paragraph}</p>);
}

export default async function BlogArticle({ locale, article, overrideContent }: { locale: Locale; article: JournalArticle; overrideContent?: CmsContent }) {
  const content = overrideContent ?? await getLocalizedPublishedContent(locale);
  const c = applyCopy(journalCopy[locale], `pages.journal.${locale}`, content.copy);
  const a = article.content[locale];
  const card = articleCard(article, locale, c.minutes);
  const related = content.articles.filter((item) => item.status === "published" && item.slug !== article.slug)
    .sort((left, right) => Number(right.content[locale].category === a.category) - Number(left.content[locale].category === a.category))
    .slice(0, 3).map((item) => articleCard(item, locale, c.minutes));
  const path = `/blog/${article.slug}`;
  const url = absoluteUrl(localizedPath(locale, path));
  const organization = organizationSchema(content.settings, locale);
  const schema = {
    "@context": "https://schema.org", "@type": "BlogPosting", headline: a.title,
    "@id": `${absoluteUrl(path)}#article`,
    description: a.excerpt, image: absoluteUrl(article.image),
    inLanguage: locale, mainEntityOfPage: url, url, author: a.author ? { "@type": "Person", name: a.author } : organization, publisher: organization,
    articleSection: a.category,
    ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
    ...(article.updatedAt ? { dateModified: article.updatedAt } : {}),
  };
  const breadcrumbs = breadcrumbSchema(locale, [
    { name: c.home, path: "" }, { name: c.blog, path: "/blog" }, { name: a.title, path },
  ]);
  const webpage = {
    ...pageSchema(locale, path, a.title), description: a.excerpt,
    mainEntity: { "@id": schema["@id"] }, breadcrumb: { "@id": breadcrumbs["@id"] },
  };
  return (
    <div className={`container ${styles.page}`}>
      <nav aria-label={c.breadcrumb} className={styles.breadcrumbs}>
        <ol>
          <li><Link href={localizedPath(locale)}>{c.home}</Link></li>
          <li><Icon name="chevron" size={15} /><Link href={localizedPath(locale, "/blog")}>{c.blog}</Link></li>
          <li><Icon name="chevron" size={15} /><span aria-current="page">{a.title}</span></li>
        </ol>
      </nav>
      <article>
        <header className={styles.header}>
          <p className="eyebrow">{a.category}</p>
          <h1>{a.title}</h1>
          <p className={styles.lead}>{a.excerpt}</p>
          <div className={styles.meta}><span>{c.by} {a.author || <Link href={localizedPath(locale, "/about")}>{content.settings.storeName}</Link>}</span><span aria-hidden="true">·</span><span>{card.readingTime}</span>{(article.updatedAt || article.publishedAt) && <><span aria-hidden="true">·</span><span>{article.updatedAt ? (locale === "th" ? "ปรับปรุง " : locale === "ar" ? "آخر تحديث: " : "Updated ") : ""}<time dateTime={article.updatedAt || article.publishedAt}>{new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date((article.updatedAt || article.publishedAt)!))}</time></span></>}</div>
        </header>
        <figure className={styles.figure}>
          <div className={styles.image} data-contained={card.imageFit === "contain" || undefined}><Image src={article.image} alt={a.imageAlt ?? (card.imageFit === "contain" ? c.productImageAlt : "")} fill loading="eager" fetchPriority="high" sizes="(max-width: 68rem) 94vw, 64rem" style={{ objectPosition: article.imagePosition, objectFit: card.imageFit }} /></div>
          <figcaption>{card.imageFit === "contain" ? c.productImageNote : c.imageNote}</figcaption>
        </figure>
        <div className={styles.readingLayout}>
          {a.sections.length > 0 && <aside className={styles.aside}>
            <details className={styles.contents} open>
              <summary>{c.contents}<Icon name="chevron" size={18} /></summary>
              <nav aria-label={c.contents}><ul>{a.sections.map((section, index) => <li key={index}><a href={`#section-${index + 1}`}>{section.title}</a></li>)}</ul></nav>
            </details>
          </aside>}
          <div className={styles.prose}>
            <div className={styles.intro}><Paragraphs text={a.intro} /></div>
            {a.sections.map((section, index) => <section id={`section-${index + 1}`} key={index} className={styles.section}>
              <h2>{section.title}</h2><Paragraphs text={section.text} />
              {!!section.bullets?.length && <ul className={styles.bullets}>{section.bullets.map((item, row) => <li key={row}>{item}</li>)}</ul>}
              {!!section.links?.length && <ul className={styles.links}>{section.links.map((link, row) => <li key={row}><a href={localizedContentHref(locale, link.href)} rel={link.href.startsWith("https://") ? "noopener noreferrer" : undefined}>{link.label}<Icon name="chevron" size={18} /></a></li>)}</ul>}
              {section.image && <figure className={styles.inlineFigure}><Image src={section.image.src} alt={section.image.alt} width={1200} height={900} sizes="(max-width: 60rem) 92vw, 42rem" />{section.image.caption && <figcaption>{section.image.caption}</figcaption>}</figure>}
              {section.table && <div className={styles.tableScroll} role="region" aria-label={section.title} tabIndex={0}><table><thead><tr>{section.table.headers.map((header, column) => <th scope="col" key={column}>{header}</th>)}</tr></thead><tbody>{section.table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, column) => column === 0 ? <th scope="row" key={column}>{cell}</th> : <td key={column}>{cell}</td>)}</tr>)}</tbody></table></div>}
            </section>)}
            {!!a.references?.length && <section className={styles.section}><h2>{locale === "th" ? "แหล่งข้อมูล" : locale === "ar" ? "المراجع" : "References"}</h2><ol className={styles.references}>{a.references.map((reference, index) => <li key={index}><a href={localizedContentHref(locale, reference.href)}>{reference.label}</a></li>)}</ol></section>}
            {!!article.relatedProductIds?.length && <section className={styles.section}><h2>{locale === "th" ? "สินค้าที่เกี่ยวข้อง" : locale === "ar" ? "منتجات ذات صلة" : "Related products"}</h2><ul className={styles.links}>{content.products.filter((product) => product.status === "published" && article.relatedProductIds?.includes(product.id)).map((product) => <li key={product.id}><Link href={localizedPath(locale, product.id === "coffee-blossom-honey" ? `/${product.slug}` : `/products/${product.slug}`)}>{product.name[locale]}<Icon name="chevron" size={18} /></Link></li>)}</ul></section>}
            <aside className={styles.author}>
              <p className="eyebrow">{content.settings.storeName}</p>
              <h2>{c.authorTitle}</h2>
              <p>{c.authorBody}</p>
              <Link href={localizedPath(locale, "/about")} className="textLink">{c.approachLink}<Icon name="chevron" size={18} /></Link>
            </aside>
            <div className={styles.actions}>
              <Link href={localizedPath(locale, "/products")} className="button">{c.products}<Icon name="chevron" size={18} /></Link>
              <Link href={localizedPath(locale, "/contact")} className="textLink">{c.contact}<Icon name="chevron" size={18} /></Link>
            </div>
          </div>
        </div>
      </article>
      {related.length > 0 && <section className={styles.related} aria-labelledby="related-heading">
        <div className={styles.relatedHeader}><div><p className="eyebrow">{c.count}</p><h2 id="related-heading">{c.related}</h2><p>{c.relatedIntro}</p></div><Link href={localizedPath(locale, "/blog")} className="textLink">{c.latest}<Icon name="chevron" size={18} /></Link></div>
        <div className={styles.relatedGrid}>{related.map((item) => <ArticleCard key={item.slug} article={item} locale={locale} read={c.read} />)}</div>
      </section>}
      {!overrideContent && <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeSchema(schema) }} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeSchema(breadcrumbs) }} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeSchema(webpage) }} /></>}
    </div>
  );
}
