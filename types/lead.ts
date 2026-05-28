export type LeadStatut =
  | "optin"
  | "resource_viewed"
  | "booking"
  | "client"
  | "perdu";

export interface Lead {
  id: string;
  Email: string;
  Prenom?: string;
  Statut: LeadStatut;
  Source?: string;
  "UTM Source"?: string;
  "UTM Medium"?: string;
  "UTM Campaign"?: string;
  "Created At"?: string;
  Notes?: string;
}
