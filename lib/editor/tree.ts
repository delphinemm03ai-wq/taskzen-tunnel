import type { Block, BlockType, Page } from "@/lib/page-format/schema";
import { childLists, findBlock, shortId, walk } from "@/lib/page-format/ops";

/** Où se trouve un bloc : liste parente (racine, section, pop-up ou colonne) et position. */
export interface Location {
  parent_id?: string;
  column?: number;
  index: number;
  siblings: Block[];
}

export function locate(page: Page, id: string): Location | null {
  const found = findBlock(page, id);
  if (!found) return null;
  let loc: Location | null = null;
  const visit = (list: Block[], parent?: Block, column?: number) => {
    const i = list.findIndex((b) => b.id === id);
    if (i >= 0) loc = { parent_id: parent?.id, column, index: i, siblings: list };
    for (const b of list) {
      const lists = childLists(b);
      lists.forEach((l, ci) => visit(l, b, b.type === "columns" ? ci : undefined));
    }
  };
  visit(page.blocks as Block[]);
  return loc;
}

/** Copie profonde d'un bloc avec de nouveaux identifiants pour lui et ses enfants. */
export function cloneWithNewIds(block: Block): Block {
  const copy = structuredClone(block) as Block;
  walk([copy], (b) => {
    b.id = shortId();
  });
  return copy;
}

/** Libellé français d'un type de bloc (panneau d'éléments, cadre de sélection). */
export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Titre",
  text: "Texte",
  list: "Liste",
  image: "Image",
  video: "Vidéo",
  button: "Bouton",
  divider: "Séparateur",
  columns: "Colonnes",
  section: "Section",
  signup_form: "Formulaire d'inscription",
  payment_button: "Bouton de paiement",
  testimonials: "Témoignages",
  faq: "Questions fréquentes",
  timer: "Minuteur",
  popup: "Pop-up",
};

export function isContainer(b: Block): boolean {
  return b.type === "columns" || b.type === "section" || b.type === "popup";
}

/** Contenu de départ d'un nouvel élément. Les textes sont des exemples à remplacer. */
export function defaultBlock(type: BlockType): Block {
  const id = shortId();
  switch (type) {
    case "heading": return { id, type, level: 2, text: "Nouveau titre" };
    case "text": return { id, type, text: "Écris ton texte ici." };
    case "list": return { id, type, items: ["Premier point", "Deuxième point"], ordered: false };
    case "image": return { id, type, src: "https://placehold.co/960x540/1b1c36/b58bf9?text=Image", alt: "Description de l'image" };
    case "video": return { id, type, src: "https://www.youtube.com/embed/", title: "Vidéo" };
    case "button": return { id, type, label: "Mon bouton", href: "#" };
    case "divider": return { id, type };
    case "columns": return { id, type, columns: [[{ id: shortId(), type: "text", text: "Colonne 1" }], [{ id: shortId(), type: "text", text: "Colonne 2" }]] };
    case "section": return { id, type, title: "Nouvelle section", children: [{ id: shortId(), type: "text", text: "Contenu de la section." }] };
    case "signup_form": return { id, type, label: "Je m'inscris", fields: ["email"] };
    case "payment_button": return { id, type, label: "Commander", product: "mon-produit", price_cents: 4700, currency: "EUR" };
    case "testimonials": return { id, type, items: [{ quote: "Un témoignage réel de ton client.", author: "Prénom" }] };
    case "faq": return { id, type, items: [{ question: "Une question ?", answer: "Sa réponse." }] };
    case "timer": return { id, type, mode: "fixed_date", ends_at: new Date(Date.now() + 3 * 86400000).toISOString().replace(/\.\d+Z$/, "Z") };
    case "popup": return { id, type, trigger_label: "Ouvrir", title: "Titre du pop-up", children: [{ id: shortId(), type: "text", text: "Contenu du pop-up." }] };
  }
}
