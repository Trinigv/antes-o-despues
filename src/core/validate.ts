import { CATEGORIES, type GameEvent } from "./types";

/** Palabras que dan pistas de orden o que el juego evita */
const BANNED = /\b(antes|después|despues|tras|luego|previo|posterior)\b/i;
/** Cualquier año de 4 cifras en el texto regala la respuesta */
const YEAR_IN_TEXT = /\b(1[5-9]\d\d|20\d\d)\b/;

export function validateEvent(e: GameEvent, now = new Date()): string[] {
  const errs: string[] = [];
  const maxYear = now.getUTCFullYear();
  if (!/^\d{4}-[a-z0-9-]+$/.test(e.id)) errs.push("id inválido (formato AAAA-slug)");
  if (!Number.isInteger(e.year) || e.year < 1500 || e.year > maxYear) errs.push("año fuera de rango");
  if (e.date !== null) {
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(e.date)) errs.push("fecha con formato inválido");
    else if (+e.date.slice(0, 4) !== e.year) errs.push("la fecha no coincide con el año");
  }
  if (!(e.category in CATEGORIES)) errs.push(`categoría desconocida: ${e.category}`);
  if (!e.title || e.title.length > 90) errs.push("título vacío o de más de 90 caracteres");
  if (e.description.length > 140) errs.push("descripción de más de 140 caracteres");
  for (const [field, text] of [["título", e.title], ["descripción", e.description]] as const) {
    if (YEAR_IN_TEXT.test(text)) errs.push(`el ${field} menciona un año`);
    if (BANNED.test(text)) errs.push(`el ${field} usa una palabra de orden (antes/después/tras…)`);
    if (/[|`]/.test(text)) errs.push(`el ${field} tiene caracteres no permitidos`);
  }
  if (!["approved", "pending", "rejected"].includes(e.status)) errs.push("status inválido");
  return errs;
}

export function validateAll(events: readonly GameEvent[]): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  const titles = new Map<string, string>();
  for (const e of events) {
    for (const m of validateEvent(e)) errs.push(`${e.id}: ${m}`);
    if (ids.has(e.id)) errs.push(`${e.id}: id duplicado`);
    ids.add(e.id);
    const key = normalize(e.title);
    if (titles.has(key)) errs.push(`${e.id}: título repetido con ${titles.get(key)}`);
    titles.set(key, e.id);
  }
  return errs;
}

export const normalize = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const slugify = (s: string, max = 48) =>
  normalize(s).replace(/ /g, "-").slice(0, max).replace(/-+$/, "");
