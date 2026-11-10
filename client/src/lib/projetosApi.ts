import { apiFetch, apiFetchNdjson, apiUploadFile } from "./backendApi";
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
  /** UFs onde o projeto pode ser executado; null/vazio = nacional. */
  abrangencia_ufs?: string[] | null;
  criado_em?: string;
  atualizado_em?: string;
};

export type ProjetoEditalMatch = {
  score: number;
  motivos: string[];
  /** Pontos dos critérios de seleção a confirmar no edital (sem dado ou fora da recomendação). */
  alertas?: string[];
  /** UFs onde o edital financia; null = nacional. */
  abrangencia?: string[] | null;
  edital: DatabaseEdital;
};

/** Contagem de editais que o match escondeu, por motivo. */
export type ProjetoEditalOcultos = {
  total: number;
  regiao: number;
  prazo: number;
  publico: number;
  tema: number;
  /** Fora dos critérios de seleção (duração, valor, TransfereGov, obra, Lei 14.133). */
  criterios?: number;
};

export type ProjetoEditaisResultado = {
  rows: ProjetoEditalMatch[];
  ocultos: ProjetoEditalOcultos | null;
  /** Se os critérios de seleção foram aplicados nesta busca. */
  criterios: boolean;
  criteriosResumo: string[];
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
    abrangencia_ufs: string[] | null;
  }>,
): Promise<Projeto> {
  const data = await apiFetch<{ row: Projeto }>(`/api/projetos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!data?.row) throw new Error("Falha ao atualizar projeto");
  return data.row;
}

export type ProjetoExtraido = {
  titulo: string;
  resumo: string;
  area: string;
  conteudo: ProjetoConteudo;
  campos_preenchidos: number;
};

/** Envia o PDF do projeto e pede à IA para preencher os campos. */
export async function extrairProjetoDePdf(file: File): Promise<ProjetoExtraido> {
  const data = await apiUploadFile<ProjetoExtraido>("/api/projetos/extrair-pdf", file, "file");
  if (!data?.conteudo) throw new Error("Não foi possível extrair os campos do PDF");
  return data;
}

export type ProjetoRascunhoInput = {
  titulo: string;
  area?: string | null;
  origem_tipo?: string | null;
  origem_descricao?: string | null;
  descricao: string;
  publico_alvo?: ProjetoPublicoAlvo;
};

/** Pede à IA um rascunho dos campos do projeto a partir de uma descrição. */
export async function gerarRascunhoProjeto(input: ProjetoRascunhoInput): Promise<ProjetoConteudo> {
  const data = await apiFetch<{ conteudo: ProjetoConteudo }>("/api/projetos/rascunho", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!data?.conteudo) throw new Error("Não foi possível gerar o rascunho");
  return data.conteudo;
}

export async function deleteProjeto(id: string): Promise<void> {
  await apiFetch(`/api/projetos/${id}`, { method: "DELETE" });
}

/** Critérios de seleção da fundação ficam ligados por padrão; `criterios: false` mostra todos. */
export async function matchEditaisForProjetoDetalhado(
  id: string,
  limit = 20,
  opts?: { criterios?: boolean },
): Promise<ProjetoEditaisResultado> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (opts?.criterios === false) qs.set("criterios", "0");
  const data = await apiFetch<{
    rows: ProjetoEditalMatch[];
    ocultos?: ProjetoEditalOcultos;
    criterios?: boolean;
    criterios_resumo?: string[];
  }>(`/api/projetos/${id}/editais?${qs}`);
  return {
    rows: Array.isArray(data?.rows) ? data.rows : [],
    ocultos: data?.ocultos ?? null,
    criterios: data?.criterios ?? opts?.criterios !== false,
    criteriosResumo: Array.isArray(data?.criterios_resumo) ? data.criterios_resumo : [],
  };
}

export async function matchEditaisForProjeto(id: string, limit = 20): Promise<ProjetoEditalMatch[]> {
  return (await matchEditaisForProjetoDetalhado(id, limit)).rows;
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
