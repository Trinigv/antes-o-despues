import type { Category, CheckResult, Puzzle, Stats } from "../core/types";
import type { Engine, FinishInput } from "./engine";

/** Habla con la función `api` de Supabase (ver supabase/functions/api) */
export class RemoteEngine implements Engine {
  readonly mode = "remote" as const;
  constructor(private base: string) {
    this.base = base.replace(/\/$/, "");
  }

  private async call<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API ${path}: ${res.status} ${await res.text()}`);
    return res.json();
  }

  daily(date: string) {
    return this.call<Puzzle>(`/puzzle?date=${date}`);
  }
  free(categories: Category[], exclude: string[]) {
    return this.call<Puzzle>("/free", { categories, exclude });
  }
  check(placed: string[], eventId: string, slot: number) {
    return this.call<CheckResult>("/check", { placed, eventId, slot });
  }
  async finish(input: FinishInput) {
    try {
      return await this.call<Stats>("/finish", input);
    } catch {
      return null;
    }
  }
}
