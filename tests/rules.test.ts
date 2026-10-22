import { describe, expect, it } from "vitest";
import { direction, fits, isSorted, pointsFor, squares, totalScore } from "../src/core/rules";

describe("puntaje", () => {
  it("evento #k con m errores vale k − m", () => {
    expect(pointsFor(3, 2)).toBe(1);
    expect(pointsFor(1, 0)).toBe(1);
    expect(pointsFor(8, 0)).toBe(8);
  });
  it("nunca baja de 0", () => expect(pointsFor(2, 5)).toBe(0));
  it("partida perfecta da 36", () => expect(totalScore([0, 0, 0, 0, 0, 0, 0, 0])).toBe(36));
  it("suma solo las cartas ya ubicadas", () => expect(totalScore([0, 1, 0, 0, 0, 0, 0, 0], 2)).toBe(1 + 1));
  it("cuadraditos según errores", () => expect(squares([0, 1, 2, 5])).toBe("🟩🟨🟧🟥"));
});

describe("ubicación en la línea", () => {
  const line = [1950, 1978, 2014];
  it("acepta el hueco correcto", () => {
    expect(fits(line, 1930, 0)).toBe(true);
    expect(fits(line, 1986, 2)).toBe(true);
    expect(fits(line, 2022, 3)).toBe(true);
  });
  it("rechaza huecos incorrectos y fuera de rango", () => {
    expect(fits(line, 1986, 1)).toBe(false);
    expect(fits(line, 1986, -1)).toBe(false);
    expect(fits(line, 1986, 9)).toBe(false);
  });
  it("indica para qué lado mover", () => {
    expect(direction(line, 1930, 2)).toBe("left");
    expect(direction(line, 2022, 1)).toBe("right");
  });
  it("detecta líneas desordenadas", () => {
    expect(isSorted(line)).toBe(true);
    expect(isSorted([1978, 1950])).toBe(false);
  });
});
