import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { GameEvent, PuzzleFile } from "../src/core/types";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const EVENTS_PATH = join(ROOT, "data/events.json");
export const PUZZLES_DIR = join(ROOT, "public/puzzles");

export function readEvents(): GameEvent[] {
  return JSON.parse(readFileSync(EVENTS_PATH, "utf8"));
}

export function writeEvents(events: GameEvent[]): void {
  const sorted = [...events].sort((a, b) => a.year - b.year || (a.date ?? "").localeCompare(b.date ?? "") || a.id.localeCompare(b.id));
  writeFileSync(EVENTS_PATH, JSON.stringify(sorted, null, 2) + "\n");
}

export function readPuzzles(): Record<string, PuzzleFile> {
  if (!existsSync(PUZZLES_DIR)) return {};
  const out: Record<string, PuzzleFile> = {};
  for (const f of readdirSync(PUZZLES_DIR)) {
    if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) continue;
    const p: PuzzleFile = JSON.parse(readFileSync(join(PUZZLES_DIR, f), "utf8"));
    out[p.date] = p;
  }
  return out;
}

export function writePuzzle(p: PuzzleFile): void {
  mkdirSync(PUZZLES_DIR, { recursive: true });
  writeFileSync(join(PUZZLES_DIR, `${p.date}.json`), JSON.stringify(p) + "\n");
}

export const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
