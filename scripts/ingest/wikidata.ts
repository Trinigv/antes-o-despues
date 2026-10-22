/**
 * Fuente: Wikidata (gratis, sin API key).
 * Busca temporadas/ediciones de competencias cuyo ganador (P1346) es un club argentino
 * o la Selección, con su fecha de finalización (P582) o fecha puntual (P585).
 */
import type { Candidate } from "./types";

const ENDPOINT = "https://query.wikidata.org/sparql";

// Solo competencias que la gente recuerda. Se filtra por etiqueta para no depender de QIDs.
const NOTABLE = /libertadores|sudamericana|intercontinental|mundial de clubes|copa am[eé]rica|copa mundial|recopa|supercopa|copa de campeones|finalissima|juegos ol[ií]mpicos|primera divisi[oó]n|liga profesional|copa de la liga|copa argentina/i;

const QUERY = (sinceYear: number) => `
SELECT ?season ?seasonLabel ?winner ?winnerLabel ?competitionLabel ?date ?isNational WHERE {
  ?season wdt:P1346 ?winner ;
          wdt:P3450 ?competition .
  ?winner wdt:P17 wd:Q414 .
  OPTIONAL { ?season wdt:P582 ?end }
  OPTIONAL { ?season wdt:P585 ?pit }
  BIND(COALESCE(?end, ?pit) AS ?date)
  FILTER(BOUND(?date) && YEAR(?date) >= ${sinceYear})
  BIND(EXISTS { ?winner wdt:P31 wd:Q6979593 } AS ?isNational)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
ORDER BY DESC(?date)
LIMIT 400`;

interface Row {
  season: { value: string };
  seasonLabel?: { value: string };
  winnerLabel?: { value: string };
  competitionLabel?: { value: string };
  date: { value: string };
  isNational?: { value: string };
}

export async function fromWikidata(sinceYear: number): Promise<Candidate[]> {
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(QUERY(sinceYear))}`;
  const res = await fetch(url, {
    headers: {
      accept: "application/sparql-results+json",
      // Wikidata pide un User-Agent identificable
      "user-agent": "antes-o-despues-futbol/0.1 (https://github.com/)",
    },
  });
  if (!res.ok) throw new Error(`Wikidata respondió ${res.status}`);
  const json = (await res.json()) as { results: { bindings: Row[] } };

  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const r of json.results.bindings) {
    const qid = r.season.value.split("/").pop()!;
    if (seen.has(qid)) continue;
    seen.add(qid);
    const competition = r.competitionLabel?.value ?? "";
    const season = r.seasonLabel?.value ?? "";
    if (!NOTABLE.test(competition) && !NOTABLE.test(season)) continue;
    if (/^Q\d+$/.test(season) || !r.winnerLabel?.value) continue; // sin etiqueta en español/inglés
    const date = r.date.value.slice(0, 10);
    out.push({
      sourceId: `wikidata:${qid}`,
      year: Number(date.slice(0, 4)),
      date,
      category: r.isNational?.value === "true" ? "sel" : "clu",
      facts: `${r.winnerLabel.value} ganó la competencia "${competition}" (edición: ${season}).`,
      sourceUrl: r.season.value,
    });
  }
  return out;
}
