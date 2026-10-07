import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/Icon";
import type { BlogCardData } from "@/lib/blog";
import { localizedPath, type Locale } from "@/lib/i18n";
import styles from "./ArticleCard.module.css";

export default function ArticleCard({ article, locale, read }: { article: BlogCardData; locale: Locale; read: string }) {
  return (
    <article className={styles.card}>
      <Link href={localizedPath(locale, `/blog/${article.slug}`)} className={styles.link}>
        <div className={styles.image} data-contained={article.imageFit === "contain" || undefined}>
          <Image src={article.image} alt="" fill sizes="(max-width: 40rem) 94vw, (max-width: 65rem) 46vw, 34rem" style={{ objectPosition: article.imagePosition, objectFit: article.imageFit }} />
          <span className={styles.category}>{article.category}</span>
        </div>
        <div className={styles.copy}>
          <p className={styles.time}>{article.readingTime}</p>
          <h3>{article.title}</h3>
          <p className={styles.excerpt}>{article.excerpt}</p>
          <span className={styles.action}>{read}<Icon name="chevron" size={20} /></span>
        </div>
      </Link>
    </article>
  );
}
