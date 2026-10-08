"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isLocale, languageConfig } from "@/lib/i18n";
import MiniCart from "@/components/commerce/MiniCart";

export default function StoreShell({
  children,
  header,
  footer,
}: {
  children: ReactNode;
  header: ReactNode;
  footer: ReactNode;
}) {
  const segments = usePathname().split("/").filter(Boolean);
  const firstSegment = segments[0] ?? "";
  const locale = isLocale(firstSegment) ? firstSegment : languageConfig.defaultLocale;
  const pageSegments = isLocale(segments[0] ?? "")
    ? segments.slice(1)
    : segments;
  const isHoneyExperience =
    pageSegments.length === 1 && pageSegments[0] === "coffee-blossom-honey";

  if (pageSegments[0] === "cms") return <>{children}</>;

  // The product story supplies its own main landmark and shares the store shell.
  if (isHoneyExperience) return <>{header}{children}{footer}<MiniCart locale={locale} /></>;

  return (
    <>
      {header}
      <main id="main-content">{children}</main>
      {footer}
      <MiniCart locale={locale} />
    </>
  );
}
