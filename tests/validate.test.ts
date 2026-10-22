import { describe, expect, it } from "vitest";
import events from "../data/events.json";
import { validateAll, validateEvent } from "../src/core/validate";
import type { GameEvent } from "../src/core/types";

const base: GameEvent = {
  id: "1986-test", year: 1986, date: "1986-06-29", precision: "day", category: "sel",
  title: "Argentina campeón del mundo", description: "Le ganó 3 a 2 a Alemania.", tags: [], source: null, status: "approved",
};

describe("validación de cartas", () => {
  it("acepta una carta correcta", () => expect(validateEvent(base)).toEqual([]));
  it("rechaza años en el texto", () => expect(validateEvent({ ...base, title: "Campeón en México 1986" })).not.toEqual([]));
  it("rechaza palabras de orden", () => expect(validateEvent({ ...base, description: "Después del Mundial..." })).not.toEqual([]));
  it("rechaza fecha que no coincide con el año", () => expect(validateEvent({ ...base, date: "1987-01-01" })).not.toEqual([]));
  it("toda la base de datos es válida", () => expect(validateAll(events as GameEvent[])).toEqual([]));
});
