"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { localizedPath, type Locale } from "@/lib/i18n";
import { siteCopy } from "@/content/site";
import { mainNavigation } from "@/content/site-structure";
import LiveSearch from "./search/LiveSearch";
import LanguageSwitcher from "./LanguageSwitcher";
import { usePublished, usePublishedCopy } from "./cms/PublishedProvider";
import { useStore } from "./commerce/StoreProvider";
import Icon from "./Icon";
import styles from "./Header.module.css";

export default function Header({ locale, availability = {} }: { locale: Locale; availability?: Record<string, Locale[]> }) {
  const { content } = usePublished();
  const c = usePublishedCopy(siteCopy[locale], `site.${locale}`),
    pathname = usePathname(),
    { itemCount, openCart, isCartOpen } = useStore();
  const [menu, setMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const headerElement = useRef<HTMLElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const localePrefix = `/${locale}`;
  const equivalentPath =
    pathname === localePrefix || pathname === "/"
      ? ""
      : pathname.startsWith(`${localePrefix}/`)
        ? pathname.slice(localePrefix.length)
        : pathname;
  const activePath = localizedPath(locale, equivalentPath);
  const isActive = (path: string) => {
    const destination = localizedPath(locale, path);
    return activePath === destination ||
      (path === "/blog" && activePath.startsWith(`${destination}/`));
  };
  useEffect(() => {
    const header = headerElement.current;
    if (!header) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty("--header-offset", `${header.getBoundingClientRect().height}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => { observer.disconnect(); root.style.removeProperty("--header-offset"); };
  }, []);
  useEffect(() => {
    if (!menu) return;
    const updateMenuSpace = () => {
      const header = headerElement.current;
      if (header) header.style.setProperty("--navigation-space", `${Math.max(0, window.innerHeight - header.getBoundingClientRect().bottom)}px`);
    };
    updateMenuSpace();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !searchOpen) {
        setMenu(false);
        menuTrigger.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    window.addEventListener("scroll", updateMenuSpace, { passive: true });
    window.addEventListener("resize", updateMenuSpace);
    return () => {
      document.removeEventListener("keydown", handler);
      window.removeEventListener("scroll", updateMenuSpace);
      window.removeEventListener("resize", updateMenuSpace);
    };
  }, [menu, searchOpen]);
  const openSearch = () => {
    setMenu(false);
    setSearchOpen(true);
  };
  return (
    <>
      <a className={styles.skip} href="#main-content">
        {c.skip}
      </a>
      <div className={styles.announcement} lang={locale}>
        <span>{c.announcement}</span>
      </div>
      <header className={styles.header} ref={headerElement}>
        <div className={styles.inner}>
          <button
            ref={menuTrigger}
            className={`${styles.iconButton} ${styles.menuButton}`}
            onClick={() => setMenu(!menu)}
            aria-label={menu ? c.close : c.menu}
            aria-expanded={menu}
            aria-controls="mobile-navigation"
          >
            <Icon name={menu ? "close" : "menu"} />
          </button>
          <Link
            href={localizedPath(locale)}
            className={styles.logo}
            
            aria-label={content.settings.storeName}
          >
            <span>{content.settings.storeName === "VETRA STORE" ? "VETRA" : content.settings.storeName}</span>
            {content.settings.storeName === "VETRA STORE" && <small dir="ltr">STORE</small>}
          </Link>
          <nav className={styles.navigation} aria-label={c.mainNav}>
            {mainNavigation.map(({ key, path }) => (
              <Link
                key={key}
                href={localizedPath(locale, path)}
                className={
                  isActive(path) ? styles.active : ""
                }
                aria-current={
                  isActive(path) ? "page" : undefined
                }
              >
                {c.nav[key]}
              </Link>
            ))}
          </nav>
          <div className={styles.actions}>
            <LanguageSwitcher locale={locale} path={equivalentPath} availableLocales={availability[equivalentPath]} onNavigate={() => setMenu(false)} />
            <span className={styles.divider} />
            <button
              className={styles.iconButton}
              onClick={openSearch}
              aria-label={c.search}
              aria-haspopup="dialog"
              aria-expanded={searchOpen}
              aria-controls="store-search"
            >
              <Icon name="search" />
            </button>
            <Link
              href={localizedPath(locale, "/account")}
              className={`${styles.iconButton} ${styles.account}`}
              aria-label={c.account}
            >
              <Icon name="user" />
            </Link>
            <button
              type="button"
              data-cart-trigger
              onClick={() => { setMenu(false); openCart(); }}
              className={styles.iconButton}
              aria-label={`${c.cart}${itemCount ? ` (${itemCount})` : ""}`}
              aria-haspopup="dialog"
              aria-controls="mini-cart"
              aria-expanded={isCartOpen}
            >
              <Icon name="bag" />
              {itemCount > 0 && (
                <span className={styles.count}>{itemCount}</span>
              )}
            </button>
          </div>
        </div>
        {menu && (
          <nav
            id="mobile-navigation"
            className={styles.mobileNav}
            aria-label={c.mobileNav}
          >
            {mainNavigation.map(({ key, path }) => (
              <Link
                key={key}
                href={localizedPath(locale, path)}
                aria-current={isActive(path) ? "page" : undefined}
                onClick={() => setMenu(false)}
              >
                {c.nav[key]}
                <Icon name="arrow" size={17} />
              </Link>
            ))}
            <Link
              href={localizedPath(locale, "/account")}
              onClick={() => setMenu(false)}
            >
              {c.account}
              <Icon name="user" size={17} />
            </Link>
            <Link
              href={localizedPath(locale, "/contact")}
              onClick={() => setMenu(false)}
            >
              {c.links.contact}
              <Icon name="arrow" size={17} />
            </Link>
          </nav>
        )}
      </header>
      <LiveSearch locale={locale} open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
