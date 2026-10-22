/**
 * Genera las partidas del día que faltan, desde hoy hasta SCHEDULE_AHEAD_DAYS adelante.
 * Nunca modifica partidas existentes: lo publicado queda fijo.
 *
 *   npm run puzzles                 # hoy → +30 días
 *   npm run puzzles -- --days 60    # más adelante
 */
import { SCHEDULE_AHEAD_DAYS, LAUNCH_DATE } from "../src/core/config";
import { addDays, today } from "../src/core/dates";
import { extendSchedule } from "../src/core/schedule";
import { arg, readEvents, readPuzzles, writePuzzle } from "./lib";

const days = Number(arg("days") ?? SCHEDULE_AHEAD_DAYS);
const start = [today(), LAUNCH_DATE].sort()[1]; // nunca antes del lanzamiento
const end = addDays(start, days);

const created = extendSchedule(readEvents(), readPuzzles(), start, end);
created.forEach(writePuzzle);
console.log(created.length ? `✓ ${created.length} partidas nuevas (${created[0].date} → ${created.at(-1)!.date})` : "✓ No faltaba ninguna partida");
