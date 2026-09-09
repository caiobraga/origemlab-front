import { formatArrecadacaoResumo } from "./editalValorStats";

export type PublicCatalogStats = {
  editaisCorretosCount: number;
  editaisAnalisadosCount: number;
  fontesCount: number;
  potencialBRL: number;
  editaisComValor: number;
};

function apiUrl(path: string) {
  // Vite DEV: always use same-origin `/api` → proxy to localhost:8081.
  // That way landing stats work even if .env points VITE_API_BASE_URL at production.
  if (import.meta.env.DEV) {
    return path;
  }
  const base = String((import.meta as any).env?.VITE_API_BASE_URL || "").replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

/** Endpoint público — sem autenticação. */
export async function fetchPublicCatalogStats(): Promise<PublicCatalogStats> {
  const res = await fetch(apiUrl("/api/public/catalog-stats"), {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`catalog-stats HTTP ${res.status}`);
  }
  const json = (await res.json()) as Partial<PublicCatalogStats> & { error?: string };
  if (json.error) {
    throw new Error(json.error);
  }
  return {
    editaisCorretosCount: Number(json.editaisCorretosCount) || 0,
    editaisAnalisadosCount: Number(json.editaisAnalisadosCount) || 0,
    fontesCount: Number(json.fontesCount) || 0,
    potencialBRL: Number(json.potencialBRL) || 0,
    editaisComValor: Number(json.editaisComValor) || 0,
  };
}

export function formatCountPlus(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `+${Math.round(n).toLocaleString("pt-BR")}`;
}

export function formatPotencialLanding(totalBRL: number): string {
  return formatArrecadacaoResumo(totalBRL).main;
}
