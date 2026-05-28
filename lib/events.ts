/**
 * Noms d'events PostHog du funnel — source unique.
 * Utilisés côté client (tracking) et côté serveur (admin / funnel stats).
 */
export const FUNNEL_EVENTS = {
  LANDING_VIEW: "landing_view",
  LEAD_SIGNUP: "lead_signup",
  RESOURCE_VIEW: "resource_view",
  RESOURCE_ENGAGED: "resource_engaged",
  BOOKING_CLICK: "booking_click",
  BOOKING_VIEW: "booking_view",
  BOOKING_COMPLETED: "booking_completed",
} as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[keyof typeof FUNNEL_EVENTS];

/** Étapes ordonnées du funnel pour le dashboard admin. */
export const FUNNEL_STEPS: ReadonlyArray<{ key: string; label: string; event: FunnelEvent }> = [
  { key: "landing", label: "Vue landing", event: FUNNEL_EVENTS.LANDING_VIEW },
  { key: "lead", label: "Email capturé", event: FUNNEL_EVENTS.LEAD_SIGNUP },
  { key: "resource", label: "Ressource vue", event: FUNNEL_EVENTS.RESOURCE_VIEW },
  { key: "booking_click", label: "Clic réserver", event: FUNNEL_EVENTS.BOOKING_CLICK },
  { key: "booking", label: "Appel réservé", event: FUNNEL_EVENTS.BOOKING_COMPLETED },
];
