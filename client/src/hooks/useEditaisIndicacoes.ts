import { useQuery } from "@tanstack/react-query";
import { refreshMyIndicacoes, fetchMyIndicacoes } from "@/lib/indicacoesApi";

export function useEditaisIndicacoes(
  userId: string | undefined,
  opts?: {
    limit?: number;
    autoRefresh?: boolean;
    enabled?: boolean;
    empresaId?: string | null;
  },
) {
  const limit = opts?.limit ?? 20;
  const autoRefresh = opts?.autoRefresh ?? true;
  const enabled = opts?.enabled ?? true;
  const empresaId = opts?.empresaId ?? null;

  return useQuery({
    queryKey: ["editais-indicacoes", userId, limit, autoRefresh, empresaId],
    enabled: !!userId && enabled,
    queryFn: async () => {
      if (!userId) return [];
      let refreshError: unknown = null;
      if (autoRefresh) {
        try {
          await refreshMyIndicacoes(limit, empresaId);
        } catch (err) {
          refreshError = err;
        }
      }
      const rows = await fetchMyIndicacoes(userId, limit, empresaId);
      if (refreshError && rows.length === 0) {
        throw refreshError;
      }
      return rows;
    },
    staleTime: 60 * 1000,
    cacheTime: 5 * 60 * 1000,
  });
}

