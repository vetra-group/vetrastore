"use client";

import NextLink, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import NavigationProgress from "./NavigationProgress";

function PendingNavigation() {
  const { pending } = useLinkStatus();
  return <NavigationProgress pending={pending} />;
}

/** Keep Next's prefetching, modifiers, downloads and cancellation behavior. */
export default function NavigationLink({ children, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink {...props}>{children}<PendingNavigation /></NextLink>;
}
