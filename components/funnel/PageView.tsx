"use client";

import { useEffect } from "react";
import { track } from "@/lib/posthog-client";
import type { FunnelEvent } from "@/lib/events";

export interface PageViewProps {
  event: FunnelEvent;
  /** Propriétés attachées à l'événement (ex. { tunnel, etape } pour le moteur de pages). */
  props?: Record<string, string>;
}

/** Capture un event de vue de page au montage, une seule fois par page. */
export function PageView({ event, props }: PageViewProps) {
  // `key` fige les props : un nouvel objet au contenu identique ne renvoie pas l'événement.
  const key = JSON.stringify(props ?? {});
  useEffect(() => {
    track(event, props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, key]);
  return null;
}
