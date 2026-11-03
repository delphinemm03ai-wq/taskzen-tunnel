import { describe, expect, it, vi } from "vitest";
import { renderPageHtml, PAGE_CSS } from "@/lib/page-format/render";
import { newPage } from "@/lib/page-format/ops";
import { BLOCK_TYPES, blockSchema } from "@/lib/page-format/schema";

const ALL_BLOCKS = [
  { type: "heading", level: 1, text: "Titre" },
  { type: "text", text: "Un\n\nDeux" },
  { type: "list", items: ["a", "b"] },
  { type: "image", src: "https://exemple.fr/i.png", alt: "illustration" },
  { type: "video", src: "https://www.youtube.com/embed/abc", title: "Vidéo" },
  { type: "button", label: "Go", href: "https://exemple.fr" },
  { type: "divider" },
  { type: "columns", columns: [[{ type: "text", text: "g" }], [{ type: "text", text: "d" }]] },
  { type: "section", title: "Section", children: [{ type: "text", text: "dedans" }] },
  { type: "signup_form", label: "Inscris-moi", fields: ["email", "first_name"] },
  { type: "payment_button", label: "Acheter", product: "offre", price_cents: 9700 },
  { type: "testimonials", items: [{ quote: "Super", author: "Exemple" }] },
  { type: "faq", items: [{ question: "Q ?", answer: "R" }] },
  { type: "timer", mode: "fixed_date", ends_at: "2030-01-01T00:00:00Z", expired_redirect: "/p/x/fin" },
  { type: "popup", trigger_label: "Ouvrir", title: "Pop", children: [{ type: "text", text: "contenu" }] },
];

describe("format de page et rendu serveur", () => {
  it("les 15 éléments du F03 sont décrits et rendus", () => {
    expect(new Set(ALL_BLOCKS.map((b) => b.type))).toEqual(new Set(BLOCK_TYPES));
    const page = newPage("pg_t", { title: "Tout", blocks: ALL_BLOCKS as never });
    const html = renderPageHtml(page);
    for (const marker of ["<h1", "<ul", "<img", "<iframe", "tz-hr", "tz-cols", "tz-section", "tz-form", "data-checkout", "tz-testimonials", "<details", "tz-timer", "<dialog"]) {
      expect(html).toContain(marker);
    }
    // chaque bloc porte son id stable dans le HTML (utile à l'éditeur)
    for (const id of JSON.stringify(page).match(/"id":"b[0-9a-f]{8}"/g) ?? []) expect(html).toContain(id.slice(6, -1));
  });

  it("le bouton de paiement appelle la route Stripe existante avec tunnel et étape", () => {
    const page = newPage("pg_p", { title: "Vente", blocks: [{ type: "payment_button", label: "Acheter", product: "offre", price_cents: 9700 }] });
    const html = renderPageHtml(page, { funnelSlug: "mon-tunnel", stepSlug: "offre" });
    expect(html).toContain('data-funnel="mon-tunnel" data-step="offre"');
    expect(renderPageHtml(newPage("pg_t", { title: "T", blocks: [{ type: "timer", mode: "fixed_date", ends_at: "2030-01-31T00:00:00Z" }] }))).toContain("Fin le 31/01/2030");
    expect(html).toContain("/api/stripe/checkout");
    expect(html).not.toContain("/api/checkout");
  });

  it("le rendu est pur : aucun appel réseau, résultat identique à chaque affichage", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const page = newPage("pg_t", { title: "Pure", blocks: [{ id: "a", type: "heading", text: "Bonjour" }] });
    expect(renderPageHtml(page)).toBe(renderPageHtml(page));
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("échappe tout texte (pas de script injecté)", () => {
    const page = newPage("pg_t", { title: "<img src=x>", blocks: [{ type: "text", text: `<script>alert("x")</script>` }, { type: "list", items: ["<b>gras</b>"] }] });
    const html = renderPageHtml(page);
    expect(html).not.toContain(`<script>alert`);
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain("&lt;b&gt;gras&lt;/b&gt;");
    expect(html).toContain("<title>&lt;img src=x&gt;</title>");
  });

  it("refuse les liens dangereux et les couleurs libres", () => {
    for (const href of ["javascript:alert(1)", "data:text/html,x", "http://non-securise.fr"]) {
      expect(blockSchema.safeParse({ type: "button", label: "x", href }).success).toBe(false);
    }
    expect(blockSchema.safeParse({ type: "text", text: "x", settings: { color: "red;background:url(x)" } }).success).toBe(false);
    expect(blockSchema.safeParse({ type: "text", text: "x", settings: { color: "#7d51d2", align: "center", spacing: "m" } }).success).toBe(true);
  });

  it("image de partage : réglage de page, sinon titre et première image (F08)", () => {
    const withImg = newPage("pg_a", { title: "Mon titre", blocks: [{ type: "image", src: "https://exemple.fr/premiere.png", alt: "x" }] });
    const html = renderPageHtml(withImg);
    expect(html).toContain('og:title" content="Mon titre"');
    expect(html).toContain('og:image" content="https://exemple.fr/premiere.png"');
    const custom = newPage("pg_b", { title: "T", share: { title: "Partage", image: "https://exemple.fr/p.png" }, blocks: [] });
    expect(renderPageHtml(custom)).toContain('og:title" content="Partage"');
  });

  it("identité Taskzen : logo, Fraunces, Inter, couleurs de la charte, pilule à dégradé, cibles 44 px", () => {
    const html = renderPageHtml(newPage("pg_t", { title: "Id", blocks: [{ type: "button", label: "Go", href: "/x" }] }));
    expect(html).toContain("/brand/logo-taskzen-512.png");
    expect(PAGE_CSS).toContain("Fraunces");
    expect(PAGE_CSS).toContain("Inter");
    expect(PAGE_CSS).toContain("#090b1e"); // indigo nuit
    expect(PAGE_CSS).toContain("#b58bf9"); // lavande
    expect(PAGE_CSS).toContain("border-radius:999px");
    expect(PAGE_CSS).toMatch(/\.tz-btn\{[^}]*min-height:48px/);
    expect(PAGE_CSS).toContain("overflow-x:hidden");
    expect(html).toContain('name="viewport"');
  });

  it("identifiants de blocs en double refusés", () => {
    expect(() => newPage("pg_t", { title: "D", blocks: [{ id: "x", type: "divider" }, { id: "x", type: "divider" }] })).toThrow(/double/);
  });
});
