import type { CurriculumData } from "@/lib/userProfile";
import type { LattesData } from "@/lib/externalAPIs";

export const ACADEMIC_LEVELS = [
  "Graduação",
  "Especialização",
  "Mestrado",
  "Doutorado",
  "Pós-doutorado",
] as const;

export type AcademicLevel = (typeof ACADEMIC_LEVELS)[number];

export type AcademicFormationEntry = {
  nivel: string;
  curso: string;
  instituicao: string;
  anoConclusao?: string;
  emAndamento?: boolean;
};

export function levelImpliesDoutorado(nivel: string): boolean {
  const n = nivel.toLowerCase();
  return n.includes("doutor") || n.includes("pós-dout") || n.includes("pos-dout");
}

export function levelImpliesMestrado(nivel: string): boolean {
  const n = nivel.toLowerCase();
  return n.includes("mestr") || levelImpliesDoutorado(nivel);
}

export function levelImpliesGraduacao(nivel: string): boolean {
  const n = nivel.toLowerCase();
  return (
    n.includes("gradua") ||
    n.includes("bacharel") ||
    n.includes("licenc") ||
    n.includes("especial") ||
    levelImpliesMestrado(nivel)
  );
}

export function shouldAskMestradoFollowUp(highestLevel: string): boolean {
  return levelImpliesDoutorado(highestLevel);
}

export function buildElegibilidadeFromFormacao(formacao: AcademicFormationEntry[]) {
  const niveis = formacao.map((f) => f.nivel).join(" ");
  const possuiDoutorado = levelImpliesDoutorado(niveis);
  const possuiMestrado =
    formacao.some((f) => f.nivel.toLowerCase().includes("mestr")) || possuiDoutorado;
  const possuiGraduacao =
    formacao.some((f) => {
      const n = f.nivel.toLowerCase();
      return n.includes("gradua") || n.includes("bacharel") || n.includes("licenc");
    }) ||
    formacao.some((f) => f.nivel.toLowerCase().includes("especial")) ||
    possuiMestrado;

  const anos = formacao
    .map((f) => parseInt(String(f.anoConclusao || "").replace(/\D/g, "").slice(0, 4), 10))
    .filter((y) => Number.isFinite(y) && y >= 1950 && y <= 2100);
  const oldest = anos.length ? Math.min(...anos) : null;
  const anosExperiencia =
    oldest != null ? Math.max(0, new Date().getFullYear() - oldest) : undefined;

  return {
    possuiDoutorado,
    possuiMestrado,
    possuiGraduacao,
    anosExperiencia,
    podeParticiparEditais: possuiGraduacao || possuiMestrado || possuiDoutorado,
    observacoes: [] as string[],
  };
}

export function buildCurriculumFromFormacao(
  formacao: AcademicFormationEntry[],
  opts?: { nome?: string; existing?: CurriculumData | LattesData | null },
): CurriculumData {
  const elegibilidade = buildElegibilidadeFromFormacao(formacao);
  const existing = opts?.existing ?? null;
  return {
    ...(existing && typeof existing === "object" ? existing : {}),
    id: existing && "id" in existing ? String(existing.id || "") : "",
    nome: opts?.nome || (existing && "nome" in existing ? String(existing.nome || "") : "") || "",
    formacao: formacao.map((f) => ({
      nivel: f.nivel.trim(),
      curso: f.curso.trim(),
      instituicao: f.instituicao.trim(),
      anoConclusao: f.anoConclusao?.trim() || undefined,
      emAndamento: f.emAndamento,
    })),
    elegibilidade,
  };
}

export function isFormationEntryComplete(entry: Partial<AcademicFormationEntry>): boolean {
  return Boolean(
    entry.nivel?.trim() &&
      entry.curso?.trim() &&
      entry.instituicao?.trim() &&
      (entry.emAndamento || entry.anoConclusao?.trim()),
  );
}
