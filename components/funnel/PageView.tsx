"use client";

import { useEffect } from "react";
import { track } from "@/lib/posthog-client";
import type { FunnelEvent } from "@/lib/events";

/** Capture un event de vue de page au montage. */
export function PageView({ event }: { event: FunnelEvent }) {
  useEffect(() => {
    track(event);
  }, [event]);
  return null;
}
