/**
 * Stripe sans SDK (ADR 007) : fetch pur vers l'API et node:crypto pour la
 * signature des webhooks.
 *
 * Trois usages : créer une session Checkout (route de checkout), vérifier un
 * événement signé (route du webhook) et relire une session payée (route de
 * téléchargement, avant l'arrivée du webhook). Les clés sont lues dans
 * process.env au moment de l'appel et ne sont jamais journalisées.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const STRIPE_API = "https://api.stripe.com/v1";

/** Tolérance sur l'horodatage de la signature, en secondes (valeur du SDK officiel). */
const SIGNATURE_TOLERANCE_SECONDS = 300;

/** Vrai si la clé secrète Stripe est présente. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Mode test uniquement tant que Delphine n'a pas validé la prod (ADR 004) :
 * une clé live (sk_live_ ou rk_live_) lève une erreur, sauf STRIPE_ALLOW_LIVE=oui.
 */
export function assertTestMode(): void {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (/^(sk|rk)_live_/.test(key) && process.env.STRIPE_ALLOW_LIVE !== "oui") {
    throw new Error("Clé Stripe live refusée : STRIPE_ALLOW_LIVE n'est pas à \"oui\"");
  }
}

/**
 * Crée une session Checkout hébergée pour un seul article, prix TTC.
 * `unit_amount` = TTC en centimes, `tax_behavior=inclusive` : la TVA est
 * incluse dans le prix (taux en config, pas de Stripe Tax).
 */
export async function createCheckoutSession(input: {
  nom: string;
  prixTtc: number;
  successUrl: string;
  cancelUrl: string;
  metadata: { funnel: string; step: string; produit: string };
}): Promise<{ id: string; url: string }> {
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "eur");
  form.set("line_items[0][price_data][unit_amount]", String(input.prixTtc));
  form.set("line_items[0][price_data][tax_behavior]", "inclusive");
  form.set("line_items[0][price_data][product_data][name]", input.nom);
  form.set("success_url", input.successUrl);
  form.set("cancel_url", input.cancelUrl);
  form.set("customer_creation", "if_required");
  form.set("metadata[funnel]", input.metadata.funnel);
  form.set("metadata[step]", input.metadata.step);
  form.set("metadata[produit]", input.metadata.produit);

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as
    | { id?: string; url?: string; error?: { message?: string; type?: string } }
    | null;
  if (!res.ok || !json?.id || !json.url) {
    // Le message d'erreur Stripe ne contient pas la clé ; on n'en garde qu'un extrait.
    const reason = json?.error?.message?.slice(0, 160) ?? "réponse illisible";
    throw new Error(`Stripe checkout failed: ${res.status} ${reason}`);
  }
  return { id: json.id, url: json.url };
}

/** Forme d'un identifiant de session Checkout (`cs_test_...` ou `cs_live_...`). */
export const CHECKOUT_SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;

/**
 * Relit une session Checkout chez Stripe (GET /v1/checkout/sessions/{id}).
 * Sert au téléchargement quand le webhook n'a pas encore enregistré la vente.
 * Session inconnue de Stripe : null. Autre échec : exception.
 */
export async function retrieveCheckoutSession(
  sessionId: string
): Promise<Pick<CheckoutSessionObject, "id" | "payment_status" | "metadata"> | null> {
  if (!CHECKOUT_SESSION_ID.test(sessionId)) return null;
  const res = await fetch(`${STRIPE_API}/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  const json = (await res.json().catch(() => null)) as
    | (CheckoutSessionObject & { error?: { message?: string } })
    | null;
  if (!res.ok || !json?.id) {
    const reason = json?.error?.message?.slice(0, 160) ?? "réponse illisible";
    throw new Error(`Stripe session lookup failed: ${res.status} ${reason}`);
  }
  return { id: json.id, payment_status: json.payment_status, metadata: json.metadata };
}

/**
 * Vérifie l'en-tête Stripe-Signature (`t=<secondes>,v1=<hex>[,v1=...]`) :
 * HMAC-SHA256 de `${t}.${corps brut}` avec le secret du webhook, comparé en
 * temps constant à chaque signature v1, horodatage à 300 s près.
 * Le corps doit être le texte exact reçu (req.text()), jamais un JSON re-sérialisé.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): boolean {
  if (!header || !secret) return false;

  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t" && /^\d+$/.test(value)) timestamp = Number(value);
    else if (key === "v1" && /^[0-9a-f]+$/i.test(value)) signatures.push(value.toLowerCase());
  }
  if (timestamp === null || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex"),
    "utf8"
  );
  return signatures.some((sig) => {
    const candidate = Buffer.from(sig, "utf8");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}

/** Ce que le webhook lit d'une session Checkout ; le reste de l'événement est ignoré. */
export interface CheckoutSessionObject {
  id: string;
  payment_status?: string;
  customer_details?: { email?: string | null; name?: string | null } | null;
  metadata?: Record<string, string> | null;
  amount_total?: number | null;
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: CheckoutSessionObject };
}

/**
 * Lit un événement déjà authentifié (signature vérifiée avant).
 * Renvoie null si le JSON n'a pas la forme minimale attendue.
 */
export function parseCheckoutEvent(rawBody: string): StripeEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const event = value as { id?: unknown; type?: unknown; data?: { object?: unknown } };
  if (typeof event.id !== "string" || typeof event.type !== "string") return null;
  const object = event.data?.object as { id?: unknown } | undefined;
  if (!object || typeof object !== "object" || typeof object.id !== "string") return null;
  return value as StripeEvent;
}
