import tree from "./cnpqAreasConhecimento.data.json";

export type CnpqEspecialidade = { codigo: string; nome: string };
export type CnpqSubarea = {
  codigo: string;
  nome: string;
  especialidades: CnpqEspecialidade[];
};
export type CnpqArea = {
  codigo: string;
  nome: string;
  subareas: CnpqSubarea[];
};
export type CnpqGrandeArea = {
  codigo: string;
  nome: string;
  areas: CnpqArea[];
};

/** Seleção CNPq (ou área personalizada fora da tabela). */
export type CnpqAreaAtuacao = {
  grandeArea: { codigo: string; nome: string };
  area: { codigo: string; nome: string };
  subarea?: { codigo: string; nome: string };
  especialidade?: { codigo: string; nome: string };
  /** Área fora da tabela oficial do CNPq. */
  custom?: boolean;
  customLabel?: string;
};

const ALL_GRANDES = tree as CnpqGrandeArea[];

/** Grandes áreas oficiais com hierarquia (exclui placeholder "Outra" vazio). */
export const CNPQ_GRANDES_AREAS: CnpqGrandeArea[] = ALL_GRANDES.filter(
  (g) => (g.areas?.length || 0) > 0,
);

export function findCnpqGrandeArea(codigo: string): CnpqGrandeArea | undefined {
  return CNPQ_GRANDES_AREAS.find((g) => g.codigo === codigo);
}

export function findCnpqArea(grandeCodigo: string, areaCodigo: string): CnpqArea | undefined {
  return findCnpqGrandeArea(grandeCodigo)?.areas.find((a) => a.codigo === areaCodigo);
}

export function findCnpqSubarea(
  grandeCodigo: string,
  areaCodigo: string,
  subCodigo: string,
): CnpqSubarea | undefined {
  return findCnpqArea(grandeCodigo, areaCodigo)?.subareas.find((s) => s.codigo === subCodigo);
}

export function formatCnpqAreaAtuacao(a: CnpqAreaAtuacao): string {
  if (a.custom && a.customLabel?.trim()) {
    const label = a.customLabel.trim();
    if (a.grandeArea?.nome && a.grandeArea.codigo !== "custom") {
      return `${a.grandeArea.nome} › ${label}`;
    }
    return label;
  }
  const parts = [a.grandeArea.nome, a.area.nome].filter(Boolean);
  if (a.subarea?.nome) parts.push(a.subarea.nome);
  if (a.especialidade?.nome) parts.push(a.especialidade.nome);
  return parts.join(" › ");
}

export function cnpqSelectionKey(a: CnpqAreaAtuacao): string {
  if (a.custom) {
    return [
      "custom",
      a.grandeArea?.codigo || "",
      (a.customLabel || "").trim().toLowerCase(),
    ].join("|");
  }
  return [
    a.grandeArea.codigo,
    a.area.codigo,
    a.subarea?.codigo || "",
    a.especialidade?.codigo || "",
  ].join("|");
}

/** Rótulos planos para `areasAtuacao` (compatível com exibição legada). */
export function cnpqAreasToLabels(areas: CnpqAreaAtuacao[]): string[] {
  return areas.map(formatCnpqAreaAtuacao);
}

export function isValidCnpqAreaEntry(a: CnpqAreaAtuacao): boolean {
  if (a.custom) return Boolean(a.customLabel?.trim());
  return Boolean(a.grandeArea?.codigo && a.area?.codigo);
}
