import { useQuery } from "@tanstack/react-query";
import { fetchPublicCatalogStats } from "@/lib/catalogStatsApi";

/** Public catalog counters shown on the landing; one shared cache entry for every section. */
export function usePublicCatalogStats() {
  return useQuery({
    queryKey: ["public-catalog-stats"],
    queryFn: fetchPublicCatalogStats,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
