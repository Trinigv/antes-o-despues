/**
 * Valida data/events.json y las partidas generadas.
 * Corre en CI y antes de cada build: si algo está mal, el deploy no sale.
 */
import { validateAll } from "../src/core/validate";
import { PUZZLE_SIZE } from "../src/core/config";
import { readEvents, readPuzzles } from "./lib";

const events = readEvents();
// Las cartas "pending" pueden tener texto a corregir: avisamos pero no frenamos el build
const pending = events.filter((e) => e.status === "pending");
const errors = validateAll(events.filter((e) => e.status !== "pending"));
const warnings = validateAll(pending);
if (warnings.length) console.warn(`⚠ ${pending.length} cartas pendientes de edición:\n` + warnings.map((w) => `  - ${w}`).join("\n"));

const byId = new Map(events.map((e) => [e.id, e]));
for (const p of Object.values(readPuzzles())) {
  if (p.ids.length !== PUZZLE_SIZE) errors.push(`partida ${p.date}: tiene ${p.ids.length} eventos`);
  const years = new Set<number>();
  for (const id of p.ids) {
    const e = byId.get(id);
    if (!e) errors.push(`partida ${p.date}: el evento ${id} no existe`);
    else if (years.has(e.year)) errors.push(`partida ${p.date}: año repetido ${e.year}`);
    else years.add(e.year);
  }
}

const approved = events.filter((e) => e.status === "approved").length;
if (errors.length) {
  console.error(`✗ ${errors.length} problemas:\n` + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log(`✓ ${events.length} eventos (${approved} aprobados) y partidas válidas`);
