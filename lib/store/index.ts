import { MemoryStore, currentStore, setStore, type Store } from "./store";
import { SupabaseStore, fetchRest } from "./supabase-store";

/**
 * Magasin partagé du processus, choisi par variables d'environnement :
 * Supabase si SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont définis (sauf TUNNEL_STORE=memory),
 * sinon mémoire (tests, développement sans base).
 */
export function getStore(): Store {
  let s = currentStore();
  if (!s) {
    const durable = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.TUNNEL_STORE !== "memory";
    if (!durable && process.env.NODE_ENV === "production") {
      console.warn("[store] Supabase non configuré : stockage en mémoire, les données seront perdues au redémarrage.");
    }
    s = durable ? new SupabaseStore(fetchRest) : new MemoryStore();
    setStore(s);
  }
  return s;
}
