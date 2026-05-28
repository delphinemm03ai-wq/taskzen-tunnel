---
description: Configure la ressource du tunnel (VSL, vidéo, PDF, quiz) et l'email Resend qui la délivre.
---
# Resource — Configuration de la ressource

Définir ce que le prospect reçoit après l'opt-in.

## Workflow

1. Demander le type : `vsl` / `video` / `pdf` / `quiz`.
2. Selon le type :
   - **video / vsl** : demander l'URL d'embed (YouTube, Vimeo, Loom, Tella...). L'écrire dans `config.ts > resource.embedUrl`.
   - **pdf** : demander le lien de téléchargement direct (Drive public, Vercel Blob, etc.). L'écrire dans `config.ts > resource.downloadUrl`.
   - **quiz** : embed ou lien d'outil tiers dans `embedUrl`.
3. Renseigner `config.ts > resource` : `type`, `title`, `description`, `ctaToBooking`.
4. **Email Resend** : `lib/resend.ts` envoie déjà un email avec un lien vers `/ressource` après l'opt-in. Adapter le contenu de l'email si besoin (titre, texte) dans `lib/resend.ts > resourceEmailHtml`.
5. Mettre à jour `memory/identity/offer.md` (section ressource).
6. `/preview` pour vérifier l'affichage de la ressource.

## Règles
- Pour une vidéo : utiliser l'URL d'EMBED, pas l'URL de partage.
- Vérifier que la ressource s'affiche bien sur `/ressource` (desktop + mobile).
- Si Resend non configuré : prévenir que l'email ne partira pas (mode démo) et proposer `/onboarding`.
