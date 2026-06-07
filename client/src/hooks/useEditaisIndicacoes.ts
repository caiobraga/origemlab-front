import { useQuery } from "@tanstack/react-query";
import { refreshMyIndicacoes, fetchMyIndicacoes } from "@/lib/indicacoesApi";

export function useEditaisIndicacoes(
  userId: string | undefined,
  opts?: { limit?: number; autoRefresh?: boolean; enabled?: boolean },
) {
  const limit = opts?.limit ?? 20;
  const autoRefresh = opts?.autoRefresh ?? true;
  const enabled = opts?.enabled ?? true;

  return useQuery({
    queryKey: ["editais-indicacoes", userId, limit, autoRefresh],
    enabled: !!userId && enabled,
    queryFn: async () => {
      if (!userId) return [];
      let refreshError: unknown = null;
      if (autoRefresh) {
        try {
          await refreshMyIndicacoes(limit);
        } catch (err) {
          // Se a RPC falhar, ainda tenta ler o cache existente; se estiver vazio, expõe o erro na UI.
          refreshError = err;
        }
      }
      const rows = await fetchMyIndicacoes(userId, limit);
      if (refreshError && rows.length === 0) {
        throw refreshError;
      }
      return rows;
    },
    staleTime: 60 * 1000,
    cacheTime: 5 * 60 * 1000,
  });
}

