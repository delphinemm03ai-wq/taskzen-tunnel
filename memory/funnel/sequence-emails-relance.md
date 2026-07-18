# Séquence email de relance (J+2, J+4, J+7)

> Complète l'email J+0 existant (`lib/resend.ts` : accès à la ressource). Cible : les leads qui ont reçu la vidéo "La Méthode IA" mais n'ont pas encore réservé leur diagnostic gratuit.
> Ton : tutoiement, direct, phrases courtes, pas de jargon (voir [[voice-guide]]). Pas d'emoji, pas de superlatifs.

---

## J+2 : rappel du chiffre qui pique

**Objet :** Le calcul que tu n'as peut-être pas fait

**Corps :**

Hello [Prénom],

Tu as reçu la vidéo il y a 2 jours. Une question simple avant d'aller plus loin.

Combien de temps tu passes chaque semaine à répondre aux mêmes questions sur WhatsApp ? Tarifs, dispo, programme.

Si c'est 10 heures, fais le calcul avec ton tarif horaire. La plupart des coachs tombent autour de 2000€ par mois de temps non facturé.

Ce n'est pas une critique. C'est juste le prix de répondre soi-même à tout, tout le temps.

Le diagnostic de 30 minutes sert exactement à ça : on regarde ensemble tes messages et on chiffre ce que TOI tu peux récupérer.

[Réserver mon diagnostic gratuit]

À très vite,

Delphine Moura-Miranda - Automatisation IA
Taskzen

---

## J+4 : lever l'objection "mes clients vont détester un robot"

**Objet :** "Mes clients vont détester parler à un robot"

**Corps :**

Hello [Prénom],

C'est la question qu'on me pose le plus souvent. Légitime.

Sauf que ce n'est pas un chatbot générique qui répond à côté de la plaque. C'est un système qui répond dans TON ton, avec TES réponses type, sur les questions que tes clients posent déjà 50 fois par mois.

Résultat : le client a sa réponse en moins de 2 minutes, à 22h un dimanche, sans savoir que ce n'est pas toi qui as tapé le message.

Et dès que la question sort du cadre, ça part directement vers toi. Aucun client n'est laissé avec une réponse à côté.

Si tu veux voir concrètement à quoi ça ressemble sur tes propres messages, c'est l'objet du diagnostic.

[Réserver mon diagnostic gratuit]

À très vite,

Delphine Moura-Miranda - Automatisation IA
Taskzen

---

## J+7 : dernier email, direct

**Objet :** Dernier message à ce sujet

**Corps :**

Hello [Prénom],

Je ne vais pas te relancer indéfiniment sur ce sujet, donc je fais simple.

Tu as la vidéo depuis une semaine. Si l'idée de récupérer 10h par semaine sans embaucher te parle, le prochain pas c'est 30 minutes avec moi, gratuites, sans engagement.

On regarde tes messages clients, je te dis exactement ce que tu peux automatiser et ce que ça change pour toi en temps et en argent. Que tu bosses avec moi après ou pas.

Si ce n'est pas le bon moment, pas de souci. Tu gardes la vidéo, et tu me recontactes quand tu veux.

[Réserver mon diagnostic gratuit]

À très vite,

Delphine Moura-Miranda - Automatisation IA
Taskzen

---

## Notes techniques (pour l'implémentation Resend)

- Ces 3 emails s'ajoutent à `sendResourceEmail()` (J+0) dans `lib/resend.ts`.
- Nécessite un déclenchement différé (J+2, J+4, J+7 après l'opt-in), donc soit un scheduler externe (cron Vercel, ou une routine cloud comme "Morning brief"), soit un champ `created_at` du lead en Airtable interrogé quotidiennement pour savoir qui relancer.
- Couper la séquence dès qu'un lead réserve un appel (webhook Cal.com ou vérification avant envoi) : ne jamais relancer quelqu'un qui a déjà booké.
- `[Réserver mon diagnostic gratuit]` = lien direct vers `/reserver`.
