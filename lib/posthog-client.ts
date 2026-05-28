"use client";

import posthog from "posthog-js";
import type { FunnelEvent } from "@/lib/events";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

let initialized = false;

export function isPostHogConfigured(): boolean {
  return Boolean(POSTHOG_KEY);
}

export function initPostHog(): void {
  if (initialized || typeof window === "undefined" || !POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    person_profiles: "always",
  });
  initialized = true;
}

/** Capture un event du funnel. No-op si PostHog n'est pas configuré (mode démo). */
export function track(event: FunnelEvent, props?: Record<string, unknown>): void {
  if (!POSTHOG_KEY || typeof window === "undefined") return;
  posthog.capture(event, props);
}
