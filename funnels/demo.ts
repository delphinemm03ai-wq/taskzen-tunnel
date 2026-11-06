import type { FunnelConfig } from "@/types/funnel";

/**
 * Tunnel de démonstration du moteur de pages : les 9 types de blocs, en 2 étapes.
 * Rendu sur /t/demo/decouverte puis /t/demo/diagnostic.
 */
const demo = {
  slug: "demo",
  nom: "Taskzen",
  etapes: [
    {
      slug: "decouverte",
      titre: "Récupère 10 heures par semaine sans embaucher",
      metaDescription:
        "Comment les coachs sportifs indépendants automatisent leurs réponses WhatsApp, email et SMS sans paraître robotiques.",
      blocs: [
        {
          type: "hero",
          eyebrow: "Coachs sportifs indépendants",
          titre: "Récupère 10 heures par semaine sans embaucher personne",
          sousTitre:
            "Tes réponses WhatsApp, email et SMS partent toutes seules, dans TON ton. Toi, tu retournes coacher.",
        },
        {
          type: "richText",
          titre: "Le support client te mange tes soirées",
          paragraphes: [
            "Un prospect te demande tes tarifs à 22h. Une cliente veut décaler sa séance. Un autre attend le lien de paiement. Chaque message prend deux minutes, mais tu en reçois des dizaines par jour.",
            [
              { texte: "Mis bout à bout, c'est souvent " },
              { texte: "10 heures par semaine", gras: true },
              { texte: " passées à répondre au lieu de coacher. Taskzen automatise ces réponses sans te faire paraître robotique, et sans que tu aies quoi que ce soit à installer." },
            ],
          ],
        },
        {
          type: "bullets",
          titre: "Ce que tu vas découvrir",
          items: [
            "Le mécanisme exact pour répondre automatiquement dans ton ton, pas celui d'un robot",
            "Le calcul de ce que ton temps de support te coûte vraiment chaque mois",
            "Comment qualifier tes prospects et caler les rendez-vous sans lever le petit doigt",
          ],
        },
        {
          type: "video",
          titre: "La Méthode IA : récupérer 10h par semaine sans embaucher",
          embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        },
        {
          type: "testimonial",
          citation:
            "J'ai passé 25 ans à faire tourner des systèmes qui n'avaient pas le droit de tomber. Aujourd'hui je mets cette rigueur au service des coachs indépendants, pour qu'ils arrêtent de passer leurs soirées dans leurs messages.",
          auteur: "Delphine Moura Miranda",
          role: "Fondatrice de Taskzen",
        },
        {
          type: "optin",
          labelPrenom: "Ton prénom",
          labelEmail: "Ton email, pour recevoir la méthode",
          boutonTexte: "Je reçois la méthode",
          tag: "demo-optin",
          etapeSuivante: "diagnostic",
          email: {
            objet: "Ta méthode pour récupérer 10 heures par semaine",
            titre: "Bienvenue, c'est parti",
            texte:
              "Merci pour ton inscription. Tu vas découvrir comment tes réponses WhatsApp, email et SMS peuvent partir toutes seules, dans ton ton, pendant que tu coaches. Prochaine étape : un diagnostic gratuit de 30 minutes pour chiffrer le temps que tu peux récupérer.",
            boutonTexte: "Voir mon diagnostic gratuit",
          },
        },
        {
          type: "cta",
          libelle: "Voir le diagnostic gratuit",
          href: "/t/demo/diagnostic",
          note: "Étape suivante : 30 minutes pour chiffrer ton temps récupérable.",
        },
      ],
    },
    {
      slug: "diagnostic",
      titre: "Ton diagnostic gratuit de 30 minutes",
      metaDescription:
        "On regarde ensemble tes messages clients et on chiffre le temps que tu peux récupérer chaque semaine. Sans engagement.",
      blocs: [
        {
          type: "hero",
          eyebrow: "Dernière étape",
          titre: "Réserve ton diagnostic gratuit de 30 minutes",
          sousTitre:
            "On regarde ensemble tes messages clients et on chiffre précisément le temps, et l'argent, que tu peux récupérer chaque semaine.",
        },
        {
          type: "image",
          src: "/images/delphine-founder.png",
          alt: "Delphine Moura Miranda, fondatrice de Taskzen",
          largeur: 1054,
          hauteur: 1492,
          legende: "Delphine, qui mène chaque diagnostic elle-même.",
        },
        {
          type: "faq",
          titre: "Tes questions avant de réserver",
          questions: [
            {
              question: "C'est vraiment gratuit ?",
              reponse:
                "Oui. Le diagnostic dure 30 minutes, sans engagement et sans vente forcée : tu repars avec le chiffrage, que tu travailles avec moi ou pas.",
            },
            {
              question: "Je dois préparer quelque chose ?",
              reponse:
                "Juste une idée du nombre de messages clients que tu reçois par jour. Le reste, on le regarde ensemble pendant l'appel.",
            },
            {
              question: "Je dois installer un logiciel ?",
              reponse:
                "Non. Tu n'as rien à installer toi-même : c'est justement le principe de Taskzen.",
            },
          ],
        },
        {
          type: "countdown",
          titre: "Avant 2027, il te reste",
          cible: "2027-01-01T00:00:00+01:00",
          messageFin: "2027 est là : c'est le moment de récupérer tes heures.",
        },
        {
          type: "cta",
          libelle: "Réserver mon diagnostic gratuit",
          href: "/reserver",
          note: "Sans engagement. Tu choisis ton créneau en deux clics.",
        },
      ],
    },
  ],
} satisfies FunnelConfig;

export default demo;
