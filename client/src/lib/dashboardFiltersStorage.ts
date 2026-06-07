export type DashboardFiltersState = {
  filtroArea: string;
  busca: string;
  mostrarInativos: boolean;
  ignorarFiltroPerfil: boolean;
  filtroTipoEdital: "pesquisadores" | "empresas" | "todos";
  apenasIndicacoes: boolean;
  ordenacao: "recentes" | "indicacoes";
  currentPage: number;
};

const STORAGE_KEY = "origemlab_dashboard_filters";

export const DEFAULT_DASHBOARD_FILTERS: DashboardFiltersState = {
  filtroArea: "todos",
  busca: "",
  mostrarInativos: false,
  ignorarFiltroPerfil: false,
  filtroTipoEdital: "todos",
  apenasIndicacoes: false,
  ordenacao: "indicacoes",
  currentPage: 1,
};

export function loadDashboardFilters(): DashboardFiltersState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DASHBOARD_FILTERS };
    const parsed = JSON.parse(raw) as Partial<DashboardFiltersState>;
    return {
      ...DEFAULT_DASHBOARD_FILTERS,
      ...parsed,
      filtroTipoEdital:
        parsed.filtroTipoEdital === "pesquisadores" ||
        parsed.filtroTipoEdital === "empresas" ||
        parsed.filtroTipoEdital === "todos"
          ? parsed.filtroTipoEdital
          : DEFAULT_DASHBOARD_FILTERS.filtroTipoEdital,
      ordenacao:
        parsed.ordenacao === "recentes" || parsed.ordenacao === "indicacoes"
          ? parsed.ordenacao
          : DEFAULT_DASHBOARD_FILTERS.ordenacao,
      currentPage:
        typeof parsed.currentPage === "number" && parsed.currentPage >= 1
          ? Math.floor(parsed.currentPage)
          : DEFAULT_DASHBOARD_FILTERS.currentPage,
    };
  } catch {
    return { ...DEFAULT_DASHBOARD_FILTERS };
  }
}

export function saveDashboardFilters(state: DashboardFiltersState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

export function clearDashboardFiltersStorage(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
