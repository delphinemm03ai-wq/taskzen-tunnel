/**
 * Cookies de progression du funnel — utilisés pour le gating des étapes
 * (voir middleware.ts) et pour éviter de re-demander l'email.
 */

export const FUNNEL_COOKIES = {
  OPTIN: "tunnel_optin",
  BOOKING: "tunnel_booking",
} as const;

export function setFunnelCookie(name: string, value: string, days = 14): void {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`;
}

export function getFunnelCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  if (!match) return null;
  return decodeURIComponent(match[2]) || null;
}
