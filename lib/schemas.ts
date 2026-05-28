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

/** Schéma de l'opt-in (étape 1 du tunnel). Email + prénom optionnel + UTM. */
export const optinSchema = z.object({
  email: emailField,
  firstName: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "Le prénom contient des caractères invalides")
    .trim()
    .optional(),
  ...utmFields,
});

export type OptinInput = z.infer<typeof optinSchema>;
