/**
 * Ingesta nocturna: trae hechos nuevos, redacta cartas y las agrega a data/events.json.
 * Corre en GitHub Actions, que abre un PR: revisarlo y mergearlo = publicar.
 * Para descartar una carta, borrala del PR: su fuente queda registrada y no vuelve.
 *
 *   npm run ingest                         # Wikidata (últimos 2 años) + inbox
 *   npm run ingest -- --since 1990 --max 20
 *   npm run ingest -- --dry                # muestra sin escribir
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { slugify, validateEvent } from "../../src/core/validate";
import type { GameEvent } from "../../src/core/types";
import { ROOT, arg, readEvents, writeEvents } from "../lib";
import { fromWikidata } from "./wikidata";
import { fromInbox } from "./inbox";
import { draft, hasLLM } from "./llm";
import type { Candidate } from "./types";

const STATE_PATH = join(ROOT, "data/ingest-state.json");
const SUMMARY_PATH = join(ROOT, ".ingest-summary.md");

const since = Number(arg("since") ?? new Date().getUTCFullYear() - 2);
const max = Number(arg("max") ?? 8);
const dry = process.argv.includes("--dry");

const state: { processed: string[] } = existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, "utf8")) : { processed: [] };
const processed = new Set(state.processed);
const events = readEvents();
const sources = new Set(events.map((e) => e.source).filter(Boolean));

const candidates: Candidate[] = [];
const inbox = fromInbox();
candidates.push(...inbox.candidates); // lo cargado a mano va primero
try {
  candidates.push(...(await fromWikidata(since)));
} catch (err) {
  console.warn(`⚠ Wikidata no respondió: ${(err as Error).message}`);
}

const fresh = candidates.filter((c) => !processed.has(c.sourceId) && !(c.sourceUrl && sources.has(c.sourceUrl)));
console.log(`${candidates.length} candidatos, ${fresh.length} nuevos. Procesando hasta ${max}${hasLLM() ? " con Claude" : " sin LLM (plantilla)"}.`);

const added: GameEvent[] = [];
const skipped: string[] = [];
const done = new Set<string>();

for (const c of fresh.slice(0, max)) {
  try {
    const sameYear = events.filter((e) => e.year === c.year).map((e) => e.title);
    const d = await draft(c, sameYear);
    done.add(c.sourceId);
    if ("duplicate" in d || "skip" in d) {
      skipped.push(`${c.year} · ${c.facts} → ${"duplicate" in d ? "ya existía" : "poco relevante"}`);
      continue;
    }
    const e: GameEvent = {
      id: `${c.year}-${slugify(d.title)}`,
      year: c.year,
      date: c.date,
      precision: c.date?.length === 10 ? "day" : c.date?.length === 7 ? "month" : "year",
      category: c.category,
      title: d.title,
      description: d.description,
      tags: ["ingesta"],
      source: c.sourceUrl,
      status: "approved",
    };
    if (events.some((x) => x.id === e.id)) {
      skipped.push(`${e.id} → id repetido`);
      continue;
    }
    const errs = validateEvent(e);
    if (!hasLLM()) {
      e.status = "pending"; // la plantilla siempre necesita una mano humana
    } else if (errs.length) {
      // Sin LLM puede quedar algo a corregir: lo dejamos "pending" para editar en el PR
      e.status = "pending";
      skipped.push(`${e.id} → queda pendiente: ${errs.join(", ")}`);
    }
    events.push(e);
    added.push(e);
  } catch (err) {
    console.warn(`✗ ${c.sourceId}: ${(err as Error).message}`);
  }
}

if (dry) {
  console.log(JSON.stringify(added, null, 2));
  process.exit(0);
}

writeEvents(events);
inbox.consume(done);
writeFileSync(STATE_PATH, JSON.stringify({ processed: [...processed, ...done].sort() }, null, 2) + "\n");

const summary = [
  `## Ingesta: ${added.length} cartas nuevas`,
  "",
  "Revisá título, descripción y **año** contra la fuente. Para descartar una, borrala de `data/events.json` en este PR.",
  "Las que quedaron `pending` necesitan edición antes de jugarse.",
  "",
  ...added.map((e) => `- **${e.year}** · \`${e.category}\` · ${e.title}${e.status === "pending" ? " ⚠ pending" : ""}\n  ${e.description}${e.source ? `\n  Fuente: ${e.source}` : ""}`),
  ...(skipped.length ? ["", "### Salteados", ...skipped.map((s) => `- ${s}`)] : []),
].join("\n");
writeFileSync(SUMMARY_PATH, summary + "\n");
console.log(summary);
