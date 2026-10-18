/**
 * Vérification rejouable de la garde du webhook Stripe (story s04, ADR 007).
 *
 * Lancé par `npm test` (Node lit le TypeScript nativement), sans réseau ni
 * dépendance : il appelle le vrai verifyStripeSignature de lib/stripe.ts et
 * le vrai prixHt de funnels/produits.ts. Sortie non nulle au premier échec.
 */

import { createHmac } from "node:crypto";
import { verifyStripeSignature } from "../lib/stripe.ts";
import { prixHt, produits } from "../funnels/produits.ts";

const SECRET = "whsec_verif_locale_sans_valeur";
const NOW = 1_760_000_000;
const BODY = JSON.stringify({ id: "evt_verif", type: "checkout.session.completed", data: { object: { id: "cs_test_verif" } } });

/** En-tête Stripe-Signature calculé indépendamment de lib/stripe.ts. */
function signe(body: string, secret: string, t: number, schema = "v1"): string {
  const hex = createHmac("sha256", secret).update(`${t}.${body}`, "utf8").digest("hex");
  return `t=${t},${schema}=${hex}`;
}

let passes = 0;
function verifie(nom: string, obtenu: unknown, attendu: unknown): void {
  if (obtenu !== attendu) {
    console.error(`ECHEC ${nom} : obtenu ${String(obtenu)}, attendu ${String(attendu)}`);
    process.exit(1);
  }
  passes += 1;
  console.log(`ok ${nom}`);
}

verifie("signature valide acceptée", verifyStripeSignature(BODY, signe(BODY, SECRET, NOW), SECRET, NOW), true);
verifie(
  "corps altéré d'un octet refusé",
  verifyStripeSignature(BODY.replace("evt_verif", "evt_verig"), signe(BODY, SECRET, NOW), SECRET, NOW),
  false
);
verifie("mauvais secret refusé", verifyStripeSignature(BODY, signe(BODY, "whsec_autre", NOW), SECRET, NOW), false);
verifie(
  "horodatage à 301 s refusé",
  verifyStripeSignature(BODY, signe(BODY, SECRET, NOW - 301), SECRET, NOW),
  false
);
verifie("v0 seul refusé", verifyStripeSignature(BODY, signe(BODY, SECRET, NOW, "v0"), SECRET, NOW), false);
verifie("en-tête absent refusé", verifyStripeSignature(BODY, null, SECRET, NOW), false);
verifie("prixHt 2700 à 5,5 % = 2559", prixHt(produits.livre), 2559);

console.log(`${passes} vérifications passées`);
