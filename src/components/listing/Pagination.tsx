import Link from "@/components/loading/NavigationLink";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageLinks, type PageSlice } from "@/lib/listing";
import type { Locale } from "@/lib/i18n";
import styles from "./Pagination.module.css";

export default function Pagination({ locale, pagination, href }: { locale: Locale; pagination: Omit<PageSlice<unknown>, "items">; href: (page: number) => string }) {
  const { page, pageCount, total, start, end } = pagination;
  if (!total) return null;
  const th = locale === "th", number = (value: number) => new Intl.NumberFormat(locale).format(value);
  return <nav className={styles.pagination} aria-label={th ? "หน้ารายการ" : locale === "ar" ? "صفحات النتائج" : "Result pages"}>
    <p>{th ? `แสดง ${number(start)}–${number(end)} จาก ${number(total)} รายการ` : locale === "ar" ? `عرض ${number(start)}–${number(end)} من أصل ${number(total)}` : `Showing ${number(start)}–${number(end)} of ${number(total)}`}</p>
    {pageCount > 1 && <><ol className={styles.links}>
      {page > 1 && <li><Link href={href(page - 1)} rel="prev" aria-label={th ? "หน้าก่อนหน้า" : locale === "ar" ? "الصفحة السابقة" : "Previous page"}><ChevronLeft aria-hidden="true" /></Link></li>}
      {pageLinks(page, pageCount).map((item) => <li key={item}>{typeof item === "number" ? <Link href={href(item)} aria-current={item === page ? "page" : undefined} aria-label={th ? `หน้า ${number(item)}` : locale === "ar" ? `الصفحة ${number(item)}` : `Page ${number(item)}`}>{number(item)}</Link> : <span className={styles.gap} aria-hidden="true">…</span>}</li>)}
      {page < pageCount && <li><Link href={href(page + 1)} rel="next" aria-label={th ? "หน้าถัดไป" : locale === "ar" ? "الصفحة التالية" : "Next page"}><ChevronRight aria-hidden="true" /></Link></li>}
    </ol><p>{th ? `หน้า ${number(page)} จาก ${number(pageCount)}` : locale === "ar" ? `الصفحة ${number(page)} من ${number(pageCount)}` : `Page ${number(page)} of ${number(pageCount)}`}</p></>}
  </nav>;
}
