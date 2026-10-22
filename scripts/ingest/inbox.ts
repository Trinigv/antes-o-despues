/**
 * Fuente: data/inbox.md — ideas cargadas a mano (por vos o por quien colabore).
 * Formato de cada línea:
 *   - AAAA[-MM[-DD]] | categoría (sel/clu/ido/mun) | qué pasó, en tus palabras | url (opcional)
 * Ejemplo:
 *   - 2001-12-27 | clu | Racing sale campeón del Apertura con Mostaza Merlo | https://es.wikipedia.org/wiki/...
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { hash } from "../../src/core/rng";
import { CATEGORIES, type Category } from "../../src/core/types";
import { ROOT } from "../lib";
import type { Candidate } from "./types";

export const INBOX_PATH = join(ROOT, "data/inbox.md");
const LINE = /^\s*-\s*(\d{4}(?:-\d{2}(?:-\d{2})?)?)\s*\|\s*(\w+)\s*\|\s*([^|]+?)\s*(?:\|\s*(\S+))?\s*$/;

export function fromInbox(): { candidates: Candidate[]; consume: (ids: Set<string>) => void } {
  if (!existsSync(INBOX_PATH)) return { candidates: [], consume: () => {} };
  const lines = readFileSync(INBOX_PATH, "utf8").split("\n");
  const candidates: Candidate[] = [];
  const lineOf = new Map<string, number>();
  lines.forEach((line, i) => {
    const m = LINE.exec(line);
    if (!m) return;
    const [, date, cat, facts, url] = m;
    if (!(cat in CATEGORIES)) return console.warn(`inbox línea ${i + 1}: categoría "${cat}" desconocida`);
    const sourceId = `inbox:${hash(line.trim()).toString(36)}`;
    lineOf.set(sourceId, i);
    candidates.push({
      sourceId,
      year: Number(date.slice(0, 4)),
      date: date.length > 4 ? date : null,
      category: cat as Category,
      facts,
      sourceUrl: url ?? null,
    });
  });
  // Saca del inbox las líneas que ya se procesaron
  const consume = (ids: Set<string>) => {
    const drop = new Set([...ids].map((id) => lineOf.get(id)).filter((n): n is number => n !== undefined));
    if (drop.size) writeFileSync(INBOX_PATH, lines.filter((_, i) => !drop.has(i)).join("\n"));
  };
  return { candidates, consume };
}
