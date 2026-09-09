/** Empresa ativa do consultor (contexto de filtro do catálogo). */
const KEY = "origemlab.activeEmpresaId";

export function getActiveEmpresaId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setActiveEmpresaId(id: string | null): void {
  try {
    if (!id) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, id);
    window.dispatchEvent(new CustomEvent("origemlab:active-empresa", { detail: id }));
  } catch {
    // ignore
  }
}
