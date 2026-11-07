import config from "@/config";
import { Block, Page } from "./schema";

/**
 * Rendu serveur d'une page, sans IA : fonction pure description -> HTML.
 * Tout texte est échappé. Les couleurs sont validées (#rrggbb) par le schéma.
 */

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Contexte d'affichage : adresse du tunnel et de l'étape (le bouton de paiement en a besoin). Rendu synchrone, donc sans risque de mélange. */
export interface RenderContext {
  funnelSlug?: string;
  stepSlug?: string;
}
let CTX: RenderContext = {};

const SPACING: Record<string, string> = { none: "0", s: "8px", m: "20px", l: "40px", xl: "72px" };

function style(b: Block): string {
  const s = b.settings;
  if (!s) return "";
  const parts: string[] = [];
  if (s.align) parts.push(`text-align:${s.align}`);
  if (s.color) parts.push(`color:${s.color}`);
  if (s.spacing) parts.push(`margin-block:${SPACING[s.spacing]}`);
  return parts.length ? ` style="${parts.join(";")}"` : "";
}

const attrs = (b: Block) => `data-block="${esc(b.id)}"${style(b)}`;

function paragraphs(t: string): string {
  return t
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function renderBlock(b: Block): string {
  switch (b.type) {
    case "heading": {
      const lvl = b.level === 1 || b.level === 3 ? b.level : 2;
      return `<h${lvl} class="tz-h" ${attrs(b)}>${esc(b.text)}</h${lvl}>`;
    }
    case "text":
      return `<div class="tz-text" ${attrs(b)}>${paragraphs(String(b.text))}</div>`;
    case "list": {
      const tag = b.ordered ? "ol" : "ul";
      return `<${tag} class="tz-list" ${attrs(b)}>${(b.items as string[]).map((i) => `<li>${esc(i)}</li>`).join("")}</${tag}>`;
    }
    case "image":
      return `<img class="tz-img" ${attrs(b)} src="${esc(b.src)}" alt="${esc(b.alt)}" loading="lazy">`;
    case "video":
      return `<div class="tz-video" ${attrs(b)}><iframe src="${esc(b.src)}" title="${esc(b.title ?? "Vidéo")}" allowfullscreen loading="lazy"></iframe></div>`;
    case "button":
      return `<p class="tz-btnwrap" ${attrs(b)}><a class="tz-btn" href="${esc(b.href)}">${esc(b.label)}</a></p>`;
    case "divider":
      return `<hr class="tz-hr" ${attrs(b)}>`;
    case "columns":
      return `<div class="tz-cols" ${attrs(b)}>${(b.columns as Block[][]).map((c) => `<div class="tz-col">${c.map(renderBlock).join("")}</div>`).join("")}</div>`;
    case "section":
      return `<section class="tz-section" ${attrs(b)}>${b.title ? `<h2 class="tz-h">${esc(b.title)}</h2>` : ""}${(b.children as Block[]).map(renderBlock).join("")}</section>`;
    case "signup_form": {
      const fields = b.fields as string[];
      return `<form class="tz-form" ${attrs(b)} data-endpoint="/api/page-optin" data-funnel="${esc(CTX.funnelSlug ?? "")}" data-step="${esc(CTX.stepSlug ?? "")}" data-block-id="${esc(b.id)}" data-next="${esc(b.next_step ?? "")}">
${fields.includes("first_name") ? `<label>Prénom<input name="firstName" autocomplete="given-name" required></label>` : ""}
<label>Email<input type="email" name="email" autocomplete="email" required></label>
<input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">
<button class="tz-btn" type="submit">${esc(b.label)}</button><p class="tz-form-msg" role="status" aria-live="polite"></p></form>`;
    }
    case "payment_button": {
      const price = ((b.price_cents as number) / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
      // Vrai bouton : le script public appelle la route Stripe existante (POST /api/stripe/checkout { funnel, step })
      // et redirige vers l'adresse Stripe renvoyée. Prix et produit sont relus côté serveur dans la config, jamais ici.
      return `<p class="tz-btnwrap" ${attrs(b)}><button class="tz-btn" type="button" data-checkout data-funnel="${esc(CTX.funnelSlug ?? "")}" data-step="${esc(CTX.stepSlug ?? "")}" data-block-id="${esc(b.id)}" data-price-cents="${b.price_cents}">${esc(b.label)} (${esc(price)})</button><span class="tz-form-msg" role="status" aria-live="polite"></span></p>`;
    }
    case "testimonials":
      return `<div class="tz-testimonials" ${attrs(b)}>${(b.items as { quote: string; author: string }[]).map((t) => `<figure><blockquote>${esc(t.quote)}</blockquote><figcaption>${esc(t.author)}</figcaption></figure>`).join("")}</div>`;
    case "faq":
      return `<div class="tz-faq" ${attrs(b)}>${(b.items as { question: string; answer: string }[]).map((q) => `<details><summary>${esc(q.question)}</summary><p>${esc(q.answer)}</p></details>`).join("")}</div>`;
    case "timer":
      return `<div class="tz-timer" ${attrs(b)} data-ends-at="${esc(b.ends_at)}" data-redirect="${esc(b.expired_redirect ?? "")}" role="timer" aria-live="off"><span data-timer-out>Fin le ${esc(String(b.ends_at).slice(8, 10))}/${esc(String(b.ends_at).slice(5, 7))}/${esc(String(b.ends_at).slice(0, 4))}</span></div>`;
    case "popup":
      return `<div ${attrs(b)}><button class="tz-btn" type="button" data-popup-open="${esc(b.id)}">${esc(b.trigger_label)}</button>
<dialog class="tz-popup" id="popup-${esc(b.id)}" aria-label="${esc(b.title)}"><button class="tz-popup-x" type="button" aria-label="Fermer" data-popup-close>×</button><h2 class="tz-h">${esc(b.title)}</h2>${(b.children as Block[]).map(renderBlock).join("")}</dialog></div>`;
    default:
      return "";
  }
}

export const PAGE_CSS = `
:root{--ink:#090b1e;--ink2:#1b1c36;--line:#313047;--fg:#f3f0f9;--mute:#a4a2b7;--lav:#b58bf9;--lav2:#c4a4fe;--deep:#7d51d2;--cream:#f9f7fd;--grad:linear-gradient(135deg,#8a55e0,#6a3fc0)}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:Inter,system-ui,sans-serif;background:var(--ink);color:var(--fg);line-height:1.6;font-size:17px;overflow-x:hidden}
.tz-wrap{max-width:760px;margin:0 auto;padding:24px 20px 64px}
.tz-brand{display:flex;align-items:center;gap:10px;font:700 1.25rem Fraunces,Georgia,serif;margin-bottom:24px}
.tz-h{font-family:Fraunces,Georgia,serif;letter-spacing:-.02em;line-height:1.15;font-weight:600;margin-block:20px 12px}
h1.tz-h{font-size:clamp(1.9rem,6vw,2.8rem)}h2.tz-h{font-size:clamp(1.5rem,4.5vw,2rem)}h3.tz-h{font-size:1.3rem}
.tz-text p,.tz-list,.tz-section>p{margin-block:12px}.tz-list{padding-left:1.4rem}
.tz-img,.tz-video iframe{max-width:100%;border-radius:1.5rem}.tz-img{display:block;height:auto;margin-block:20px}
.tz-video{position:relative;aspect-ratio:16/9;margin-block:20px}.tz-video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.tz-btnwrap{margin-block:20px}
.tz-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:.85rem 1.8rem;border-radius:999px;border:0;font:600 1.05rem Inter,sans-serif;color:#fff;background:var(--grad);box-shadow:0 10px 28px -8px rgba(125,81,210,.7);cursor:pointer;text-decoration:none}
.tz-btn:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid var(--lav2);outline-offset:3px}
.tz-hr{border:0;border-top:1px solid var(--line);margin-block:32px}
.tz-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:20px;margin-block:20px}
.tz-section{margin-block:32px;padding:24px;border-radius:1.5rem;background:var(--ink2);border:1px solid var(--line)}
.tz-form{display:grid;gap:14px;margin-block:20px;padding:24px;border-radius:1.5rem;background:var(--ink2);border:1px solid var(--line)}
.tz-form label{display:grid;gap:6px;font-weight:600;font-size:.95rem}
.tz-form input{min-height:48px;padding:.6rem 1rem;border-radius:1rem;border:1px solid var(--line);background:var(--ink);color:var(--fg);font:inherit}
.tz-form-msg{min-height:1.4em;color:var(--mute);font-size:.9rem}
.tz-testimonials{display:grid;gap:16px;margin-block:20px}
.tz-testimonials figure{padding:20px;border-radius:1.5rem;background:var(--ink2);border:1px solid var(--line)}
.tz-testimonials figcaption{margin-top:8px;color:var(--mute);font-size:.9rem}
.tz-faq details{border-bottom:1px solid var(--line);padding:14px 0}.tz-faq summary{cursor:pointer;font-weight:600;min-height:44px;display:flex;align-items:center}
.tz-timer{font:700 clamp(1.6rem,7vw,2.4rem) Fraunces,Georgia,serif;text-align:center;color:var(--lav2);margin-block:20px}
.tz-popup{max-width:min(92vw,520px);padding:28px;border-radius:1.5rem;border:1px solid var(--line);background:var(--ink2);color:var(--fg)}
.tz-popup::backdrop{background:rgba(9,11,30,.7)}
.tz-popup-x{position:absolute;top:8px;right:8px;min-width:44px;min-height:44px;border:0;background:transparent;color:var(--fg);font-size:1.6rem;cursor:pointer}
.tz-foot{margin-top:48px;padding-top:16px;border-top:1px solid var(--line);color:var(--mute);font-size:.85rem;text-align:center}
.tz-foot a{color:inherit}
`;

/**
 * Habillage de l'éditeur visuel (le même moteur de rendu, en mode édition) : cadres de survol et de sélection.
 * Les clics sont interceptés par l'éditeur, pas par la page : aucun script public n'est chargé en mode édition.
 */
export const EDITOR_CSS = `
[data-block]{position:relative;border-radius:12px;outline:2px solid transparent;outline-offset:4px;cursor:pointer}
[data-block].ed-hover{outline:2px dashed rgba(181,139,249,.75)}
[data-block].ed-sel{outline:2px solid #b58bf9;box-shadow:0 0 0 6px rgba(181,139,249,.18)}
[data-block].ed-hover::before,[data-block].ed-sel::before{content:attr(data-label);position:absolute;top:-26px;left:-2px;z-index:5;font:600 11px Inter,sans-serif;background:#6a3fc0;color:#fff;padding:3px 9px;border-radius:8px 8px 8px 0;white-space:nowrap;pointer-events:none}
.ed-tools{position:absolute;z-index:10;display:flex;gap:2px;padding:3px;border-radius:999px;background:#131428;box-shadow:0 6px 18px rgba(0,0,0,.5)}
.ed-tools button{width:32px;height:30px;border:0;border-radius:999px;background:transparent;color:#fff;font-size:14px;cursor:pointer}
.ed-tools button:hover:not(:disabled){background:#6a3fc0}.ed-tools button:disabled{opacity:.35;cursor:default}
html{overflow-x:hidden}
.ed-empty{border:2px dashed #6a3fc0;border-radius:1.5rem;padding:32px;text-align:center;color:var(--lav2);font-weight:600}
`;

/** Petit script public (aucun appel à une IA) : minuteur à date fixe, pop-up, formulaire d'inscription. */
export const PAGE_JS = `
(function(){
document.querySelectorAll('.tz-timer').forEach(function(el){
  var end=Date.parse(el.dataset.endsAt),out=el.querySelector('[data-timer-out]');
  function tick(){var d=end-Date.now();
    if(d<=0){out.textContent='Terminé';if(el.dataset.redirect)location.href=el.dataset.redirect;return}
    var s=Math.floor(d/1e3),j=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);
    out.textContent=(j?j+' j ':'')+h+' h '+m+' min '+(s%60)+' s';setTimeout(tick,1000)}
  tick()});
document.querySelectorAll('[data-popup-open]').forEach(function(b){
  b.addEventListener('click',function(){var d=document.getElementById('popup-'+b.dataset.popupOpen);if(d&&d.showModal)d.showModal()})});
document.querySelectorAll('dialog.tz-popup').forEach(function(d){
  d.querySelector('[data-popup-close]').addEventListener('click',function(){d.close()});
  d.addEventListener('click',function(e){if(e.target===d)d.close()})});
document.querySelectorAll('[data-checkout]').forEach(function(b){
  b.addEventListener('click',function(){var msg=b.parentNode.querySelector('.tz-form-msg');b.disabled=true;
    fetch('/api/stripe/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({funnel:b.dataset.funnel,step:b.dataset.step,block:b.dataset.blockId})})
      .then(function(r){return r.json()}).then(function(j){if(j&&j.ok&&j.data&&j.data.url)location.href=j.data.url;else throw 0})
      .catch(function(){b.disabled=false;msg.textContent='Le paiement n\\u2019a pas pu d\\u00e9marrer, r\\u00e9essaie.'})})});
document.querySelectorAll('form.tz-form').forEach(function(f){
  f.addEventListener('submit',function(e){e.preventDefault();var msg=f.querySelector('.tz-form-msg');
    var body={email:f.email.value,funnel:f.dataset.funnel,step:f.dataset.step,block:f.dataset.blockId,website:f.website.value};if(f.firstName)body.firstName=f.firstName.value;
    fetch(f.dataset.endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){if(!r.ok)throw 0;if(f.dataset.next)location.href=f.dataset.next;else msg.textContent='Merci, c\\u2019est enregistr\\u00e9.'})
      .catch(function(){msg.textContent='Une erreur est survenue, r\\u00e9essaie.'})})});
})();
`;

/** Liens légaux du pied de page : confidentialité et CGV seulement quand elles sont publiées. */
function legalLinks(): string {
  const { mentionsUrl, privacyUrl, cgvUrl } = config.legal as { mentionsUrl: string; privacyUrl: string | null; cgvUrl: string | null };
  const links: [string | null, string][] = [[mentionsUrl, "Mentions légales"], [privacyUrl, "Politique de confidentialité"], [cgvUrl, "Conditions générales de vente"]];
  return links.filter(([u]) => u).map(([u, l]) => `<a href="${esc(u)}">${l}</a>`).join(" · ");
}

/** Fragment HTML du corps de page (utilisé aussi par l'aperçu). */
export function renderBlocksHtml(page: Page, ctx: RenderContext = {}): string {
  CTX = ctx;
  return (page.blocks as Block[]).map(renderBlock).join("\n");
}

/** Document HTML complet. Image de partage : réglage de page, sinon titre + première image (F08). */
export function renderPageHtml(page: Page, opts: { logoUrl?: string; editor?: boolean } & RenderContext = {}): string {
  const firstImage = findFirstImage(page.blocks as Block[]);
  const ogTitle = page.share.title ?? page.title;
  const ogImage = page.share.image ?? firstImage;
  const logo = opts.logoUrl ?? "/brand/logo-taskzen-512.png";
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(page.title)}</title>
<meta property="og:title" content="${esc(ogTitle)}">
${page.share.description ? `<meta property="og:description" content="${esc(page.share.description)}">` : ""}
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${PAGE_CSS}${opts.editor ? EDITOR_CSS : ""}</style></head>
<body><div class="tz-wrap"><div class="tz-brand"><img src="${esc(logo)}" alt="" width="32" height="32">Taskzen</div>
<main>${renderBlocksHtml(page, opts)}</main>${opts.editor ? "" : `<footer class="tz-foot">${legalLinks()}</footer>`}</div>${opts.editor ? "" : `<script>${PAGE_JS}</script>`}</body></html>`;
}

function findFirstImage(blocks: Block[]): string | undefined {
  for (const b of blocks) {
    if (b.type === "image") return b.src as string;
    const kids: Block[][] =
      b.type === "columns" ? (b.columns as Block[][]) : b.type === "section" || b.type === "popup" ? [b.children as Block[]] : [];
    for (const k of kids) {
      const r = findFirstImage(k);
      if (r) return r;
    }
  }
  return undefined;
}
