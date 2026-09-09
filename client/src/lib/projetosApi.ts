import { apiFetch, apiFetchNdjson } from "./backendApi";
import type { DatabaseEdital } from "./editaisApi";
import type { ProjetoConteudo } from "./projetoFormFields";
import { propostaToProjetoInput, projetoToPropostaCampos } from "./projetoPropostaBridge";
import {
  createProposta,
  fetchPropostaByEdital,
  updateProposta,
  type Proposta,
} from "./propostasApi";

export type ProjetoPublicoAlvo = "pesquisador" | "empresa" | "ambos";
export type ProjetoStatus = "rascunho" | "ativo" | "arquivado";

export type Projeto = {
  id: string;
  owner_user_id: string;
  empresa_id?: string | null;
  titulo: string;
  resumo?: string | null;
  objetivos?: string | null;
  area?: string | null;
  publico_alvo: ProjetoPublicoAlvo;
  status: ProjetoStatus;
  conteudo?: ProjetoConteudo | Record<string, unknown>;
  criado_em?: string;
  atualizado_em?: string;
};

export type ProjetoEditalMatch = {
  score: number;
  motivos: string[];
  edital: DatabaseEdital;
};

export async function fetchProjetos(empresaId?: string): Promise<Projeto[]> {
  const qs = empresaId ? `?empresa_id=${encodeURIComponent(empresaId)}` : "";
  const data = await apiFetch<{ rows: Projeto[] }>(`/api/projetos${qs}`);
  return Array.isArray(data?.rows) ? data.rows : [];
}

export async function fetchProjeto(id: string): Promise<Projeto> {
  const data = await apiFetch<{ row: Projeto }>(`/api/projetos/${id}`);
  if (!data?.row) throw new Error("Projeto não encontrado");
  return data.row;
}

export async function createProjeto(input: {
  titulo: string;
  resumo?: string | null;
  objetivos?: string | null;
  area?: string | null;
  publico_alvo?: ProjetoPublicoAlvo;
  status?: ProjetoStatus;
  empresa_id?: string | null;
  conteudo?: ProjetoConteudo | Record<string, unknown>;
}): Promise<Projeto> {
  const data = await apiFetch<{ row: Projeto }>("/api/projetos", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!data?.row) throw new Error("Falha ao criar projeto");
  return data.row;
}

export async function updateProjeto(
  id: string,
  patch: Partial<{
    titulo: string;
    resumo: string | null;
    objetivos: string | null;
    area: string | null;
    publico_alvo: ProjetoPublicoAlvo;
    status: ProjetoStatus;
    empresa_id: string | null;
    conteudo: ProjetoConteudo | Record<string, unknown>;
  }>,
): Promise<Projeto> {
  const data = await apiFetch<{ row: Projeto }>(`/api/projetos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!data?.row) throw new Error("Falha ao atualizar projeto");
  return data.row;
}

export async function deleteProjeto(id: string): Promise<void> {
  await apiFetch(`/api/projetos/${id}`, { method: "DELETE" });
}

export async function matchEditaisForProjeto(id: string, limit = 20): Promise<ProjetoEditalMatch[]> {
  const data = await apiFetch<{ rows: ProjetoEditalMatch[] }>(
    `/api/projetos/${id}/editais?limit=${encodeURIComponent(String(limit))}`,
  );
  return Array.isArray(data?.rows) ? data.rows : [];
}

/** Cria Projeto a partir de uma Proposta existente (mapeamento estrutural). */
export async function createProjetoFromProposta(
  proposta: Proposta,
  opts?: { area?: string | null; publico_alvo?: ProjetoPublicoAlvo; empresa_id?: string | null },
): Promise<Projeto> {
  const input = propostaToProjetoInput(proposta, { area: opts?.area });
  return createProjeto({
    ...input,
    publico_alvo: opts?.publico_alvo ?? "ambos",
    status: "rascunho",
    empresa_id: opts?.empresa_id ?? null,
  });
}

/** Abre/cria Proposta para um edital já preenchida com o texto do Projeto (mapeamento estrutural). */
export async function createPropostaFromProjeto(input: {
  projeto: Projeto;
  editalId: string;
  userId: string;
}): Promise<{ proposta: Proposta; created: boolean }> {
  const existing = await fetchPropostaByEdital(input.userId, input.editalId);
  if (existing) {
    const campos = asRecord(existing.campos_formulario);
    const d = asRecord(campos.detalhamento_projeto);
    const hasContent =
      Boolean(String(campos.titulo_projeto || "").trim()) ||
      Boolean(String(d.resumo_publicavel || "").trim()) ||
      Boolean(String(d.caracterizacao_problema || "").trim());
    if (!hasContent || !existing.projeto_id) {
      const fromProjeto = projetoToPropostaCampos(input.projeto);
      const merged = hasContent ? { ...fromProjeto, ...campos } : fromProjeto;
      const row = await updateProposta(existing.id, input.userId, {
        campos_formulario: merged as any,
        projeto_id: input.projeto.id,
        proxima_etapa: "Revisar campos preenchidos a partir do projeto",
      });
      return { proposta: row, created: false };
    }
    return { proposta: existing, created: false };
  }

  const campos = projetoToPropostaCampos(input.projeto);
  const proposta = await createProposta(input.editalId, input.userId, campos as any, {
    projetoId: input.projeto.id,
    empresaId: input.projeto.empresa_id ?? null,
    geradoComIa: false,
  });
  await updateProposta(proposta.id, input.userId, {
    progresso: 15,
    proxima_etapa: "Revisar e adaptar o texto do projeto ao edital",
    status: "em_redacao",
  });
  return { proposta, created: true };
}

/**
 * Gera proposta completa adaptando cada seção do projeto ao edital com IA.
 * Emite progresso via onProgress (ex.: 3 de 17 — Metodologia).
 */
export async function gerarPropostaAdaptadaFromProjeto(input: {
  projetoId: string;
  editalId: string;
  force?: boolean;
  onProgress?: (p: { current: number; total: number; field: string }) => void;
}): Promise<{
  proposta: Proposta;
  created: boolean;
  adapted: boolean;
  fieldsAdapted?: string[];
  fieldsFailed?: Array<{ field: string; error: string }>;
  message?: string;
}> {
  let done: {
    row: Proposta;
    created?: boolean;
    adapted?: boolean;
    fields_adapted?: string[];
    fields_failed?: Array<{ field: string; error: string }>;
    message?: string;
  } | null = null;

  for await (const evt of apiFetchNdjson(
    `/api/projetos/${encodeURIComponent(input.projetoId)}/gerar-proposta`,
    {
      method: "POST",
      body: JSON.stringify({
        edital_id: input.editalId,
        force: Boolean(input.force),
        stream: true,
      }),
    },
  )) {
    const type = String(evt.type || "");
    if (type === "progress") {
      input.onProgress?.({
        current: Number(evt.current) || 0,
        total: Number(evt.total) || 0,
        field: String(evt.field || ""),
      });
      continue;
    }
    if (type === "start") {
      input.onProgress?.({
        current: 0,
        total: Number(evt.total) || 0,
        field: "Preparando…",
      });
      continue;
    }
    if (type === "error") {
      throw new Error(String(evt.error || "Erro ao gerar proposta"));
    }
    if (type === "done") {
      done = evt as typeof done;
    }
  }

  if (!done?.row) throw new Error("Falha ao gerar proposta a partir do projeto");
  return {
    proposta: done.row,
    created: Boolean(done.created),
    adapted: Boolean(done.adapted),
    fieldsAdapted: done.fields_adapted,
    fieldsFailed: done.fields_failed,
    message: done.message,
  };
}

function asRecord(v: unknown): Record<string, any> {
  return v && typeof v === "object" ? (v as Record<string, any>) : {};
}
