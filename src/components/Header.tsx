"use client";
import Image from "next/image";
import Link from "@/components/loading/NavigationLink";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { localizedPath, type Locale } from "@/lib/i18n";
import { siteCopy } from "@/content/site";
import { mainNavigation } from "@/content/site-structure";
import type { MainNavigationKey } from "@/content/site-structure";
import LiveSearch from "./search/LiveSearch";
import CurrencyDialog from "./commerce/CurrencyDialog";
import LanguageSwitcher from "./LanguageSwitcher";
import { usePublished, usePublishedCopy } from "./cms/PublishedProvider";
import { useStore } from "./commerce/StoreProvider";
import Icon from "./Icon";
import type { IconName } from "./Icon";
import { Modal } from "./ui/Modal";
import styles from "./Header.module.css";

const mobileIcons: Record<MainNavigationKey, IconName> = {
  home: "home",
  shop: "box",
  story: "info",
  journal: "journal",
};

export default function Header({ locale, availability = {} }: { locale: Locale; availability?: Record<string, Locale[]> }) {
  const { content } = usePublished();
  const c = usePublishedCopy(siteCopy[locale], `site.${locale}`),
    pathname = usePathname(),
    { itemCount, openCart, isCartOpen, displayCurrency } = useStore();
  const [menu, setMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const headerElement = useRef<HTMLElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const drawerClose = useRef<HTMLButtonElement>(null);
  const searchAfterDrawer = useRef(false);
  const returnSearchFocusToMenu = useRef(false);
  const currencyLabel = { en: "Display currency", th: "สกุลเงินที่แสดง", ar: "عملة العرض" }[locale];
  const currencyButton = () => <button
    type="button"
    className={styles.currencyButton}
    aria-label={`${currencyLabel}: ${displayCurrency}`}
    aria-haspopup="dialog"
    aria-expanded={currencyOpen}
    aria-controls="store-currencies"
    onClick={() => setCurrencyOpen(true)}
  ><bdi dir="ltr">{displayCurrency}</bdi></button>;
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
      (path === "/products" && (activePath.startsWith(`${destination}/`) || activePath === localizedPath(locale, "/coffee-blossom-honey"))) ||
      (path === "/blog" && activePath.startsWith(`${destination}/`));
  };
  const currentLocation = (path: string) => activePath === localizedPath(locale, path)
    ? "page" as const
    : isActive(path) ? "location" as const : undefined;
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
    const compact = window.matchMedia("(max-width: 50rem)");
    const closeOnDesktop = () => { if (!compact.matches) setMenu(false); };
    compact.addEventListener("change", closeOnDesktop);
    return () => compact.removeEventListener("change", closeOnDesktop);
  }, []);
  const openSearch = () => {
    returnSearchFocusToMenu.current = false;
    setSearchOpen(true);
  };
  const openDrawerSearch = () => {
    searchAfterDrawer.current = true;
    returnSearchFocusToMenu.current = true;
    setMenu(false);
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
          <div className={styles.mobileLeading}>
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
            {currencyButton()}
          </div>
          <Link
            href={localizedPath(locale)}
            className={styles.logo}
            aria-label={content.settings.storeName}
          >
            {content.settings.storeName === "VETRA STORE" ? (
              <Image src="/vetra-store-logo.svg" alt="" width={1352} height={541} className={styles.logoImage} priority />
            ) : (
              <span className={styles.logoText}>{content.settings.storeName}</span>
            )}
          </Link>
          <nav className={styles.navigation} aria-label={c.mainNav}>
            {mainNavigation.map(({ key, path }) => (
              <Link
                key={key}
                href={localizedPath(locale, path)}
                className={
                  isActive(path) ? styles.active : ""
                }
                aria-current={currentLocation(path)}
              >
                {c.nav[key]}
              </Link>
            ))}
          </nav>
          <div className={styles.actions}>
            <div className={styles.desktopCurrency}>{currencyButton()}</div>
            <LanguageSwitcher locale={locale} path={equivalentPath} availableLocales={availability[equivalentPath]} onNavigate={() => setMenu(false)} />
            <span className={styles.divider} />
            <button
              className={`${styles.iconButton} ${styles.headerSearch}`}
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
      </header>
      <Modal
        id="mobile-navigation"
        label={c.mobileNav}
        className={styles.mobileDrawer}
        open={menu}
        animate
        onClose={() => setMenu(false)}
        onAfterClose={() => {
          if (searchAfterDrawer.current) {
            searchAfterDrawer.current = false;
            setSearchOpen(true);
          }
        }}
        initialFocusRef={drawerClose}
      >
        <div className={styles.drawerFrame}>
          <div className={styles.drawerHeading}>
            {content.settings.storeName === "VETRA STORE" ? (
              <Image src="/vetra-store-logo.svg" alt={content.settings.storeName} width={1352} height={541} className={styles.drawerLogo} />
            ) : (
              <strong className={styles.drawerStoreName}>{content.settings.storeName}</strong>
            )}
            <button ref={drawerClose} type="button" className={styles.drawerClose} aria-label={c.close} onClick={() => setMenu(false)}><Icon name="close" /></button>
          </div>
          <div className={styles.drawerContent}>
            <nav className={styles.mobileNav} aria-label={c.mobileNav}>
              {mainNavigation.map(({ key, path }) => (
                <Link
                  key={key}
                  href={localizedPath(locale, path)}
                  prefetch={false}
                  aria-current={currentLocation(path)}
                  className={isActive(path) ? styles.mobileActive : ""}
                  onClick={() => setMenu(false)}
                >
                  <Icon name={mobileIcons[key]} size={22} />
                  <span>{c.nav[key]}</span>
                </Link>
              ))}
            </nav>
            <div className={styles.drawerUtilities}>
              <button type="button" onClick={openDrawerSearch} aria-haspopup="dialog" aria-controls="store-search" aria-expanded={searchOpen}>
                <Icon name="search" size={22} /><span>{c.search}</span>
              </button>
              <Link href={localizedPath(locale, "/account")} prefetch={false} onClick={() => setMenu(false)}>
                <Icon name="user" size={22} /><span>{c.account}</span>
              </Link>
              <Link href={localizedPath(locale, "/contact")} prefetch={false} onClick={() => setMenu(false)}>
                <Icon name="mail" size={22} /><span>{c.links.contact}</span>
              </Link>
            </div>
          </div>
          <div className={styles.drawerFooter}>{c.bottom}</div>
        </div>
      </Modal>
      <CurrencyDialog locale={locale} open={currencyOpen} onClose={() => setCurrencyOpen(false)} />
      <LiveSearch locale={locale} open={searchOpen} onClose={() => setSearchOpen(false)} onAfterClose={() => {
        if (returnSearchFocusToMenu.current) {
          returnSearchFocusToMenu.current = false;
          menuTrigger.current?.focus({ preventScroll: true });
        }
      }} />
    </>
  );
}
