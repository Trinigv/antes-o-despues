import { describe, expect, it } from "vitest";
import events from "../data/events.json";
import { PUZZLE_SIZE } from "../src/core/config";
import { addDays } from "../src/core/dates";
import { cooldownDays, extendSchedule } from "../src/core/schedule";
import { pickSet } from "../src/core/select";
import { seeded } from "../src/core/rng";
import type { GameEvent } from "../src/core/types";

const EVENTS = events as GameEvent[];

describe("pickSet", () => {
  it("elige 9 eventos con años distintos", () => {
    for (let i = 0; i < 200; i++) {
      const set = pickSet(EVENTS, seeded(`t${i}`))!;
      expect(set).toHaveLength(PUZZLE_SIZE);
      expect(new Set(set.map((e) => e.year)).size).toBe(PUZZLE_SIZE);
    }
  });
  it("respeta el filtro de categorías", () => {
    const set = pickSet(EVENTS, seeded("cat"), { categories: ["clu"] })!;
    expect(set.every((e) => e.category === "clu")).toBe(true);
  });
  it("es determinístico con la misma semilla", () => {
    const a = pickSet(EVENTS, seeded("x"))!.map((e) => e.id);
    const b = pickSet(EVENTS, seeded("x"))!.map((e) => e.id);
    expect(a).toEqual(b);
  });
});

describe("calendario de partidas", () => {
  const start = "2026-10-22";
  const days = 120;
  const sched = extendSchedule(EVENTS, {}, start, addDays(start, days - 1));
  const cooldown = cooldownDays(EVENTS.filter((e) => e.status === "approved").length);

  it("genera una partida por día", () => expect(sched).toHaveLength(days));

  it(`no repite eventos dentro de la ventana de ${cooldown} días`, () => {
    for (let i = 0; i < sched.length; i++) {
      const recent = new Set(sched.slice(Math.max(0, i - cooldown), i).flatMap((p) => p.ids));
      for (const id of sched[i].ids) expect(recent.has(id)).toBe(false);
    }
  });

  it("no toca las partidas existentes", () => {
    const fixed = { [start]: { date: start, number: 1, ids: sched[0].ids.slice().reverse() } };
    const again = extendSchedule(EVENTS, fixed, start, addDays(start, 3));
    expect(again.map((p) => p.date)).toEqual([addDays(start, 1), addDays(start, 2), addDays(start, 3)]);
  });
});
