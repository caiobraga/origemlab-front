import { useEffect, useRef, useState } from "react";
import {
  clearDashboardFiltersStorage,
  DEFAULT_DASHBOARD_FILTERS,
  loadDashboardFilters,
  saveDashboardFilters,
  type DashboardFiltersState,
} from "@/lib/dashboardFiltersStorage";

export function useDashboardFilters() {
  const [filters, setFilters] = useState<DashboardFiltersState>(() => loadDashboardFilters());
  const skipPageResetRef = useRef(true);

  useEffect(() => {
    saveDashboardFilters(filters);
  }, [filters]);

  useEffect(() => {
    if (skipPageResetRef.current) {
      skipPageResetRef.current = false;
      return;
    }
    setFilters((prev) => (prev.currentPage === 1 ? prev : { ...prev, currentPage: 1 }));
  }, [
    filters.busca,
    filters.filtroArea,
    filters.filtroTipoEdital,
    filters.mostrarInativos,
    filters.ignorarFiltroPerfil,
    filters.apenasIndicacoes,
    filters.ordenacao,
  ]);

  const patchFilters = (patch: Partial<DashboardFiltersState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const clearFilters = () => {
    clearDashboardFiltersStorage();
    setFilters({ ...DEFAULT_DASHBOARD_FILTERS });
  };

  return {
    ...filters,
    setFiltroArea: (filtroArea: string) => patchFilters({ filtroArea }),
    setBusca: (busca: string) => patchFilters({ busca }),
    setMostrarInativos: (mostrarInativos: boolean) => patchFilters({ mostrarInativos }),
    setIgnorarFiltroPerfil: (ignorarFiltroPerfil: boolean) => patchFilters({ ignorarFiltroPerfil }),
    setFiltroTipoEdital: (filtroTipoEdital: DashboardFiltersState["filtroTipoEdital"]) =>
      patchFilters({ filtroTipoEdital }),
    setApenasIndicacoes: (apenasIndicacoes: boolean) => patchFilters({ apenasIndicacoes }),
    setOrdenacao: (ordenacao: DashboardFiltersState["ordenacao"]) => patchFilters({ ordenacao }),
    setCurrentPage: (currentPage: number) => patchFilters({ currentPage }),
    clearFilters,
  };
}
