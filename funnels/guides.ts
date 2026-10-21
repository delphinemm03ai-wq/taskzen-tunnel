import type { FunnelConfig } from "@/types/funnel";
import { etapeInscription, etapeMerci, type Guide } from "./guides-sommet";

/**
 * Tunnel « Guides Taskzen » : les guides de Delphine qui ne viennent pas du sommet
 * (méthodes et outils). Même fonctionnement que les guides du sommet : une étape
 * d'inscription par guide (prénom + e-mail), un tag `guide-<nom>`, le PDF en pièce
 * jointe, puis une page de remerciement. Les PDF sont dans private/guides/.
 */
const GUIDES: readonly Guide[] = [
  { slug: "quick-capture-obsidian", titre: "Quick Capture d'Obsidian : noter une idée en 3 gestes", fichier: "10-delphine-quick-capture-obsidian-memo.pdf" },
  { slug: "shorts-avec-claude", titre: "Transformer une vidéo en shorts avec Claude : les outils et la méthode", fichier: "11-delphine-shorts-avec-claude-guide.pdf" },
];

const guides = {
  slug: "guides",
  nom: "Guides Taskzen",
  etapes: [...GUIDES.map(etapeInscription), etapeMerci],
} satisfies FunnelConfig;

export default guides;
