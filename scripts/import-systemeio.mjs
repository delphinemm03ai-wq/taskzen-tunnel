#!/usr/bin/env node
/**
 * Import d'un export CSV Systeme.io vers Supabase (tables tunnel_*, story s02).
 *
 * Node pur, zéro dépendance. Par défaut : --dry-run (lecture et rapport,
 * aucun appel réseau). --apply écrit dans la base, en upsert idempotent :
 * relancer l'import ne crée aucun doublon (UNIQUE email, UNIQUE nom de tag,
 * PK composite contact/tag, voir supabase/migrations/001_tunnel_contacts.sql).
 *
 * Mêmes endpoints PostgREST que lib/supabase.ts (upsertContact, ensureTags,
 * tagContact), réécrits ici car un script Node ne peut pas importer du TS.
 *
 * Usage :
 *   node scripts/import-systemeio.mjs <fichier.csv> [--dry-run | --apply]
 *        [--email-col email] [--prenom-col first_name] [--tags-col tags]
 */

import { existsSync, readFileSync } from "node:fs";

const HELP = `Import d'un export CSV Systeme.io vers Supabase (tables tunnel_*).

Usage :
  node scripts/import-systemeio.mjs <fichier.csv> [options]

Options :
  --dry-run            Lit le fichier et affiche le rapport, sans rien écrire
                       ni appeler le réseau (mode par défaut).
  --apply              Écrit dans Supabase (upsert, relançable sans doublon).
                       Lit SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans
                       l'environnement, ou dans .env.local s'il existe.
  --email-col <nom>    Colonne de l'email (défaut : email).
  --prenom-col <nom>   Colonne du prénom (défaut : first_name).
  --tags-col <nom>     Colonne des tags, séparés par , ou | (défaut : tags).
  --help               Affiche cette aide.

Le séparateur (; ou ,), le BOM UTF-8 et l'encodage Windows sont détectés.`;

const CHUNK = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Arguments ─────────────────────────────────────────────

function parseArgs(argv) {
  const opts = {
    file: null,
    apply: false,
    help: false,
    emailCol: "email",
    prenomCol: "first_name",
    tagsCol: "tags",
  };
  const valued = { "--email-col": "emailCol", "--prenom-col": "prenomCol", "--tags-col": "tagsCol" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--apply") opts.apply = true;
    else if (arg === "--dry-run") opts.apply = false;
    else if (arg in valued) {
      const value = argv[++i];
      if (!value) throw new Error(`Valeur manquante après ${arg}`);
      opts[valued[arg]] = value;
    } else if (arg.startsWith("--")) throw new Error(`Option inconnue : ${arg}`);
    else if (!opts.file) opts.file = arg;
    else throw new Error(`Argument en trop : ${arg}`);
  }
  return opts;
}

// ── Lecture du CSV ────────────────────────────────────────

/** UTF-8 si le contenu est valide, sinon Windows-1252 (exports Excel). */
function decode(buffer) {
  const hasBom = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return { text: text.replace(/^﻿/, ""), encoding: hasBom ? "utf-8 (BOM)" : "utf-8" };
  } catch {
    return { text: new TextDecoder("windows-1252").decode(buffer), encoding: "windows-1252" };
  }
}

/** ; ou , : celui qui apparaît le plus dans la ligne d'en-tête, hors guillemets. */
function detectSeparator(text) {
  let semi = 0;
  let comma = 0;
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "\n" || ch === "\r")) break;
    else if (!quoted && ch === ";") semi++;
    else if (!quoted && ch === ",") comma++;
  }
  return semi >= comma && semi > 0 ? ";" : ",";
}

/** Parseur CSV (RFC 4180) : guillemets, "" échappés, retours à la ligne dans un champ. */
function parseCsv(text, sep) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Lignes entièrement vides ignorées (fin de fichier, lignes blanches).
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function columnIndex(header, name) {
  const wanted = name.trim().toLowerCase();
  return header.findIndex((h) => h.trim().toLowerCase() === wanted);
}

/**
 * Regroupe les lignes par email normalisé (trim + minuscules) : deux lignes
 * Email@X et email@x font un seul contact, tags cumulés, dernier prénom non vide.
 */
function collect(rows, opts) {
  const [header, ...lines] = rows;
  const emailIdx = columnIndex(header, opts.emailCol);
  const prenomIdx = columnIndex(header, opts.prenomCol);
  const tagsIdx = columnIndex(header, opts.tagsCol);
  if (emailIdx === -1) {
    throw new Error(
      `Colonne email "${opts.emailCol}" introuvable. En-têtes : ${header.join(" | ")}`
    );
  }

  const contacts = new Map();
  const errors = [];
  lines.forEach((cells, i) => {
    const lineNo = i + 2; // +1 pour l'en-tête, +1 pour compter à partir de 1
    const email = (cells[emailIdx] ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      errors.push(`ligne ${lineNo} : email invalide ou vide`);
      return;
    }
    const firstName = prenomIdx === -1 ? "" : (cells[prenomIdx] ?? "").trim();
    const tags =
      tagsIdx === -1
        ? []
        : (cells[tagsIdx] ?? "").split(/[,|]/).map((t) => t.trim()).filter(Boolean);

    const contact = contacts.get(email) ?? { email, firstName: "", tags: new Set() };
    if (firstName) contact.firstName = firstName;
    tags.forEach((t) => contact.tags.add(t));
    contacts.set(email, contact);
  });

  return { lineCount: lines.length, contacts: [...contacts.values()], errors };
}

// ── Écriture Supabase (--apply uniquement) ────────────────

function loadEnv() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY manquants (environnement ou .env.local)."
    );
  }
}

function chunks(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function rest(table, { method = "GET", query = {}, prefer, body }) {
  const base = process.env.SUPABASE_URL.replace(/\/+$/, "");
  const url = new URL(`${base}/rest/v1/${table}`);
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(prefer && { Prefer: prefer }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Supabase injoignable (projet en pause ?) : ${err.message}`);
  }
  if (!res.ok) throw new Error(`${method} ${table} : ${res.status} ${await res.text()}`);
  return res.status === 204 ? [] : res.json();
}

async function applyImport(contacts, errors) {
  const stats = { created: 0, updated: 0, tagsNew: 0, tagsKnown: 0 };
  const idByEmail = new Map();

  // 1. Contacts : emails déjà présents (pour le rapport), puis upsert sur email.
  //    Deux groupes, car un lot PostgREST porte les mêmes colonnes partout :
  //    un prénom absent ne doit pas effacer un prénom déjà connu.
  for (const batch of chunks(contacts, CHUNK)) {
    try {
      const inList = batch.map((c) => `"${c.email.replace(/"/g, '\\"')}"`).join(",");
      const existing = await rest("tunnel_contacts", {
        query: { select: "email", email: `in.(${inList})` },
      });
      const known = new Set(existing.map((r) => String(r.email).toLowerCase()));

      const withName = batch.filter((c) => c.firstName);
      const withoutName = batch.filter((c) => !c.firstName);
      for (const group of [withName, withoutName]) {
        if (group.length === 0) continue;
        const rows = await rest("tunnel_contacts", {
          method: "POST",
          query: { on_conflict: "email", select: "id,email" },
          prefer: "resolution=merge-duplicates,return=representation",
          body: group.map((c) =>
            c.firstName ? { email: c.email, first_name: c.firstName } : { email: c.email }
          ),
        });
        rows.forEach((r) => idByEmail.set(String(r.email).toLowerCase(), r.id));
      }
      batch.forEach((c) => (known.has(c.email) ? stats.updated++ : stats.created++));
    } catch (err) {
      errors.push(`contacts ${batch[0].email}... : ${err.message}`);
    }
  }

  // 2. Tags : créés s'ils manquent, ids récupérés (merge-duplicates les renvoie tous).
  const tagNames = [...new Set(contacts.flatMap((c) => [...c.tags]))];
  const idByTag = new Map();
  for (const batch of chunks(tagNames, CHUNK)) {
    try {
      const rows = await rest("tunnel_tags", {
        method: "POST",
        query: { on_conflict: "name", select: "id,name" },
        prefer: "resolution=merge-duplicates,return=representation",
        body: batch.map((name) => ({ name })),
      });
      rows.forEach((r) => idByTag.set(r.name, r.id));
    } catch (err) {
      errors.push(`tags : ${err.message}`);
    }
  }

  // 3. Liaisons : ignore-duplicates ne renvoie que les paires réellement ajoutées.
  const links = [];
  for (const c of contacts) {
    const contactId = idByEmail.get(c.email);
    if (!contactId) continue;
    for (const tag of c.tags) {
      const tagId = idByTag.get(tag);
      if (tagId) links.push({ contact_id: contactId, tag_id: tagId });
    }
  }
  for (const batch of chunks(links, CHUNK)) {
    try {
      const inserted = await rest("tunnel_contact_tags", {
        method: "POST",
        query: { on_conflict: "contact_id,tag_id", select: "contact_id" },
        prefer: "resolution=ignore-duplicates,return=representation",
        body: batch,
      });
      stats.tagsNew += inserted.length;
      stats.tagsKnown += batch.length - inserted.length;
    } catch (err) {
      errors.push(`liaisons : ${err.message}`);
    }
  }

  return stats;
}

// ── Programme ─────────────────────────────────────────────

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`${err.message}\n\n${HELP}`);
    return 2;
  }
  if (opts.help) {
    console.log(HELP);
    return 0;
  }
  if (!opts.file) {
    console.error(`Fichier CSV manquant.\n\n${HELP}`);
    return 2;
  }
  if (!existsSync(opts.file)) {
    console.error(`Fichier introuvable : ${opts.file}`);
    return 2;
  }

  const { text, encoding } = decode(readFileSync(opts.file));
  const sep = detectSeparator(text);
  const rows = parseCsv(text, sep);
  if (rows.length === 0) {
    console.error("Fichier vide.");
    return 2;
  }

  let result;
  try {
    result = collect(rows, opts);
  } catch (err) {
    console.error(err.message);
    return 2;
  }
  const { lineCount, contacts, errors } = result;
  const tagPairs = contacts.reduce((n, c) => n + c.tags.size, 0);

  console.log(`Import Systeme.io : ${opts.file}`);
  console.log(`Séparateur "${sep}", encodage ${encoding}`);

  if (!opts.apply) {
    console.log("Mode : dry-run (rien n'est écrit, aucun appel réseau). Relance avec --apply pour écrire.");
    console.log(`${lineCount} lignes lues, ${contacts.length} contacts uniques, ${tagPairs} tags à poser`);
  } else {
    try {
      loadEnv();
    } catch (err) {
      console.error(err.message);
      return 2;
    }
    console.log("Mode : apply (écriture dans Supabase).");
    const stats = await applyImport(contacts, errors);
    console.log(`${lineCount} lignes lues, ${contacts.length} contacts uniques, ${tagPairs} tags à poser`);
    console.log(`Contacts créés : ${stats.created}, mis à jour : ${stats.updated}`);
    console.log(`Tags posés : ${stats.tagsNew} nouveaux, ${stats.tagsKnown} déjà posés`);
  }

  console.log(`Erreurs : ${errors.length}`);
  errors.forEach((e) => console.log(`  - ${e}`));
  return errors.length > 0 ? 1 : 0;
}

process.exitCode = await main();
