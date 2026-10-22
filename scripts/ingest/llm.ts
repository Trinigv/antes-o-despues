/**
 * Redacta el título y la descripción de una carta con la API de Claude.
 * El LLM NO decide la fecha: solo escribe texto a partir de hechos de una fuente.
 * Sin ANTHROPIC_API_KEY usa una plantilla simple (queda para editar a mano en el PR).
 */
import { validateEvent } from "../../src/core/validate";
import type { GameEvent } from "../../src/core/types";
import type { Candidate } from "./types";

const SYSTEM = `Escribís cartas para "Antes o Después", un juego argentino donde hay que ubicar momentos del fútbol en una línea de tiempo.
Reglas estrictas:
- Español rioplatense, tono de hincha informado, sin exagerar.
- "title": máximo 70 caracteres. Frase corta y reconocible: "Racing gana la Copa Sudamericana".
- "description": máximo 110 caracteres. Un dato que ayude a recordar el momento (rival, estadio, figura).
- NUNCA menciones años, décadas ni edades que revelen la fecha.
- NUNCA uses palabras de orden temporal: antes, después, tras, luego, previo, posterior.
- No uses nombres de torneos que incluyan el año (decí "el Mundial de México", no "México 86").
- No inventes datos: si no estás seguro de un detalle, no lo pongas.
- Si el hecho ya está cubierto por algún título de la lista "ya existentes", respondé {"duplicate": true}.
- Si el hecho es irrelevante para un hincha argentino promedio, respondé {"skip": true}.
Respondé SOLO un objeto JSON: {"title": "...", "description": "..."} o {"duplicate": true} o {"skip": true}.`;

type Draft = { title: string; description: string } | { duplicate: true } | { skip: true };

export const hasLLM = () => !!process.env.ANTHROPIC_API_KEY;

export async function draft(c: Candidate, existingSameYear: string[]): Promise<Draft> {
  if (!hasLLM()) {
    const title = c.facts.replace(/\s*\(edición:.*\)\.?$/, "").replace(/\b(1[5-9]|20)\d\d\b/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
    return { title, description: "" };
  }
  const user = `Hecho (año ${c.year}, categoría ${c.category}): ${c.facts}
Fuente: ${c.sourceUrl ?? "carga manual"}
Ya existentes ese año: ${existingSameYear.length ? existingSameYear.map((t) => `"${t}"`).join(", ") : "ninguno"}`;

  let last = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 300,
        system: SYSTEM,
        messages: [{ role: "user", content: attempt ? `${user}\n\nTu respuesta anterior no cumplía las reglas (${last}). Corregila.` : user }],
      }),
    });
    if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { content: { type: string; text?: string }[] };
    const text = body.content.find((b) => b.type === "text")?.text ?? "";
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) {
      last = "no devolvió JSON";
      continue;
    }
    const d = JSON.parse(json) as Draft;
    if ("duplicate" in d || "skip" in d) return d;
    const probe: GameEvent = {
      id: `${c.year}-x`, year: c.year, date: null, precision: "year", category: c.category,
      title: d.title, description: d.description, tags: [], source: null, status: "approved",
    };
    const errs = validateEvent(probe);
    if (!errs.length) return d;
    last = errs.join("; ");
  }
  throw new Error(`El LLM no logró una carta válida: ${last}`);
}
