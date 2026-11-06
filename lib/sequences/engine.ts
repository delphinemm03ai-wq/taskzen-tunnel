import type { SequenceRecord } from "@/lib/store/store";

export interface Enrollee {
  contactId: string;
  email: string;
  firstName: string | null;
  unsubscribedAt: string | null;
  /** Date de pose de l'étiquette : le moment où la personne entre dans la séquence. */
  enrolledAt: string;
}

export interface SequenceRepo {
  listActive(): Promise<SequenceRecord[]>;
  enrollees(tag: string): Promise<Enrollee[]>;
  lastSaleByContact(contactIds: string[]): Promise<Map<string, string>>;
  sentKeys(sequenceId: string): Promise<Set<string>>;
  /** Réserve l'envoi en base. false si une autre exécution l'a déjà pris. */
  claim(sequenceId: string, emailId: string, contactId: string): Promise<boolean>;
  release(sequenceId: string, emailId: string, contactId: string): Promise<void>;
}

export type SendEmail = (msg: { enrollee: Enrollee; subject: string; body: string }) => Promise<{ ok: boolean; reason?: string }>;

const HOUR = 3_600_000;
// Au-delà, un e-mail serait hors de propos : un rappel envoyé après le webinaire n'a plus de sens.
const MAX_LATE_DATE_MS = HOUR;
const MAX_LATE_RELATIVE_MS = 24 * HOUR;

export const sentKey = (emailId: string, contactId: string) => `${emailId}:${contactId}`;

export interface RunReport {
  sent: number;
  failed: number;
  skippedLate: number;
  remaining: number;
}

export async function runSequences(
  repo: SequenceRepo,
  send: SendEmail,
  opts: { now?: Date; maxSends?: number; pauseMs?: number } = {}
): Promise<RunReport> {
  const now = (opts.now ?? new Date()).getTime();
  const maxSends = opts.maxSends ?? 50;
  const report: RunReport = { sent: 0, failed: 0, skippedLate: 0, remaining: 0 };

  for (const seq of await repo.listActive()) {
    const tag = seq.trigger.tag;
    if (!seq.activated_at || !tag) continue;
    const isDate = seq.trigger.type === "date";
    const dateBase = isDate && seq.trigger.date ? Date.parse(seq.trigger.date) : null;
    if (isDate && dateBase === null) continue;
    const activatedAt = Date.parse(seq.activated_at);

    const enrollees = await repo.enrollees(tag);
    const sales = seq.exit_on.includes("purchase") ? await repo.lastSaleByContact(enrollees.map((e) => e.contactId)) : new Map<string, string>();
    const sent = await repo.sentKeys(seq.id);

    for (const person of enrollees) {
      if (person.unsubscribedAt && seq.exit_on.includes("unsubscribe")) continue;
      const enrolledAt = Date.parse(person.enrolledAt);
      const sale = sales.get(person.contactId);
      if (sale && Date.parse(sale) >= enrolledAt) continue;
      // Sans date fixe, seules les inscriptions postérieures à l'activation comptent : jamais d'envoi à l'ancienne liste.
      if (!isDate && enrolledAt < activatedAt) continue;

      let due = dateBase ?? enrolledAt;
      for (const email of seq.emails) {
        due += email.delay_hours * HOUR;
        if (due > now) break;
        if (sent.has(sentKey(email.id, person.contactId))) continue;
        // Inscrit après l'heure prévue : ce rappel-là ne le concerne pas.
        if (isDate && enrolledAt > due) continue;
        if (now - due > (isDate ? MAX_LATE_DATE_MS : MAX_LATE_RELATIVE_MS)) {
          report.skippedLate++;
          continue;
        }
        if (report.sent + report.failed >= maxSends) {
          report.remaining++;
          continue;
        }
        if (!(await repo.claim(seq.id, email.id, person.contactId))) continue;
        const result = await send({ enrollee: person, subject: email.subject, body: email.body });
        if (result.ok) {
          report.sent++;
        } else {
          report.failed++;
          console.error(`[sequences] envoi échoué (${seq.id}/${email.id}) :`, result.reason);
          await repo.release(seq.id, email.id, person.contactId);
        }
        if (opts.pauseMs) await new Promise((r) => setTimeout(r, opts.pauseMs));
      }
    }
  }
  return report;
}
