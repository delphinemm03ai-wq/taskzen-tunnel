import type { FunnelConfig } from "@/types/funnel";
import demo from "./demo";

/**
 * Registre des tunnels : un nouveau fichier funnels/<slug>.ts s'ajoute ici,
 * et ses étapes sont générées statiquement au prochain build.
 */
export const allFunnels: readonly FunnelConfig[] = [demo];

export function getFunnel(slug: string): FunnelConfig | undefined {
  return allFunnels.find((f) => f.slug === slug);
}
