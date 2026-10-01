"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { TAB_NAVIGATION_START, tabIndex } from "@/lib/tab-navigation-timing";

/** Next invokes onNavigate only for same-window client navigations, not modifier clicks. */
export function TabLink(props: Omit<ComponentProps<typeof Link>, "onNavigate"> & { href: string }) {
  return <Link {...props} onNavigate={() => {
    const tab = tabIndex(props.href);
    if (tab >= 0) window.dispatchEvent(new CustomEvent(TAB_NAVIGATION_START, { detail: tab }));
  }} />;
}
