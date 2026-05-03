import type { DatabaseEdital } from "@/lib/editaisApi";
import { apiFetch } from "@/lib/backendApi";

export type EditalIndicacaoRow = {
  edital_id: string;
  user_id: string;
  score: number;
  motivos: string[];
  gerado_em: string;
};

export type EditalIndicacaoItem = {
  score: number;
  motivos: string[];
  geradoEm: string;
  edital: DatabaseEdital;
};

export async function refreshMyIndicacoes(limit = 20): Promise<number> {
  const out = await apiFetch<{ refreshed: number }>("/api/indicacoes/refresh", {
    method: "POST",
    body: JSON.stringify({ limit }),
  });
  return Number(out.refreshed ?? 0);
}

export async function fetchMyIndicacoes(userId: string, limit = 20): Promise<EditalIndicacaoItem[]> {
  const out = await apiFetch<{ rows: Array<any> }>(`/api/indicacoes?limit=${encodeURIComponent(String(limit))}`, { method: "GET" });
  const rows = (out.rows ?? []) as Array<{
    score: number;
    motivos: string[] | null;
    gerado_em: string;
    edital: DatabaseEdital | null;
  }>;

  return rows
    .filter((r) => r.edital != null)
    .map((r) => ({
      score: r.score,
      motivos: r.motivos ?? [],
      geradoEm: r.gerado_em,
      edital: r.edital as DatabaseEdital,
    }));
}

