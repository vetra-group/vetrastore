"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { applyCopy } from "@/lib/cms/apply-copy";
import type { PublicContent } from "@/lib/cms/public-content";

const PublishedContext = createContext<PublicContent | null>(null);

export function PublishedProvider({ content, children }: { content: PublicContent; children: ReactNode }) {
  return <PublishedContext.Provider value={content}>{children}</PublishedContext.Provider>;
}

export function usePublished() {
  const content = useContext(PublishedContext);
  if (!content) throw new Error("Published content must be read within PublishedProvider.");
  return { content, products: content.products };
}

export function usePublishedCopy<T>(source: T, prefix: string): T {
  const { content } = usePublished();
  return useMemo(() => applyCopy(source, prefix, content.copy), [source, prefix, content.copy]);
}
