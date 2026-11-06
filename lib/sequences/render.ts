import config from "@/config";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Marqueurs restés à remplir, comme {lien_salle_paylive}. {first_name} est rempli à l'envoi. */
export function findPlaceholders(text: string): string[] {
  const found = text.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g) ?? [];
  return [...new Set(found.filter((m) => m !== "{first_name}"))];
}

function inline(line: string): string {
  return esc(line)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, `<a href="$2" style="color:${config.brand.colorPrimary};font-weight:600;">$1</a>`);
}

function block(chunk: string): string {
  const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length && lines.every((l) => /^[-*] /.test(l))) {
    return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join("")}</ul>`;
  }
  if (lines.length && lines.every((l) => /^\d+\. /.test(l))) {
    return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\. /, ""))}</li>`).join("")}</ol>`;
  }
  return `<p>${lines.map(inline).join("<br/>")}</p>`;
}

/** Remplace {first_name}. Sans prénom connu, le mot disparaît : « Salut {first_name}, » devient « Salut, ». */
export function fillFirstName(text: string, firstName?: string | null): string {
  const name = firstName?.trim();
  return name ? text.replace(/\{first_name\}/g, name) : text.replace(/\s*\{first_name\}/g, "");
}

export function renderSequenceEmail(input: { body: string; firstName?: string | null; unsubscribeUrl?: string }): string {
  const html = fillFirstName(input.body, input.firstName).split(/\n{2,}/).map(block).join("\n");
  const footer = input.unsubscribeUrl
    ? `<p style="color:#4a4963;font-size:12px;margin-top:32px;">Tu reçois cet e-mail parce que tu t'es inscrit(e) sur un tunnel Taskzen. <a href="${esc(input.unsubscribeUrl)}" style="color:#4a4963;">Me désinscrire</a></p>`
    : "";
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;color:#131428;line-height:1.5;">${html}${footer}</div>`;
}
