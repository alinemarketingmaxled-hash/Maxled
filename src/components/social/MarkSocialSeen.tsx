"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markSocialSeenAction } from "@/app/(app)/social/actions";

/** Invisible — just marks Comunicados as seen once this page actually
 * mounts in the browser, then refreshes so the Sidebar's unread badge
 * (fetched in the shared layout) clears. Runs from a client effect rather
 * than during the page's server render so a Link hover-prefetch of
 * /social never marks posts read before the user actually opens it. */
export function MarkSocialSeen() {
  const router = useRouter();

  useEffect(() => {
    markSocialSeenAction().then(() => router.refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
