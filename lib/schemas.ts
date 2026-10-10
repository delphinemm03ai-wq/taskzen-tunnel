import { z } from "zod";

/** Email réutilisable : blocklist jetables, format strict, lowercase. */
const emailField = z
  .string()
  .email("Adresse email invalide")
  .max(255)
  .regex(
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    "Format d'email invalide"
  )
  .refine(
    (email) => {
      const domain = email.split("@")[1];
      if (!domain) return false;
      const disposable = [
        "yopmail.com",
        "tempmail.com",
        "guerrillamail.com",
        "mailinator.com",
        "throwaway.email",
      ];
      return !disposable.includes(domain.toLowerCase());
    },
    { message: "Merci d'utiliser une adresse email permanente" }
  )
  .transform((v) => v.trim().toLowerCase());

const utmFields = {
  utmSource: z.string().max(255).optional(),
  utmMedium: z.string().max(255).optional(),
  utmCampaign: z.string().max(255).optional(),
};

/** Schéma de l'opt-in (étape 1 du tunnel). Email + prénom requis + UTM. */
export const optinSchema = z.object({
  email: emailField,
  firstName: z
    .string({ required_error: "Le prénom est requis" })
    .min(1, "Le prénom est requis")
    .max(50)
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "Le prénom contient des caractères invalides")
    .trim(),
  ...utmFields,
});

export type OptinInput = z.infer<typeof optinSchema>;

/**
 * Schéma de l'opt-in du moteur de pages (bloc `optin`, route /api/optin).
 * Prénom optionnel ici : son caractère obligatoire vient de la config du bloc,
 * vérifié par la route. `website` est le honeypot : rempli = robot.
 */
export const funnelOptinSchema = z.object({
  email: z.string({ required_error: "L'adresse email est requise" }).pipe(emailField),
  firstName: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .max(50, "Le prénom est trop long")
      .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "Le prénom contient des caractères invalides")
      .trim()
      .optional()
  ),
  funnel: z.string({ required_error: "Tunnel manquant" }).min(1, "Tunnel manquant").max(100),
  step: z.string({ required_error: "Étape manquante" }).min(1, "Étape manquante").max(100),
  website: z.string().max(500).optional(),
});

export type FunnelOptinInput = z.infer<typeof funnelOptinSchema>;
