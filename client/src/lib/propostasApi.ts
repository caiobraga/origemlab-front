import { apiFetch } from "./backendApi";
import { createEmptyPropostaForm, type PropostaFormData } from "./propostaFormFields";
import {
  canUsePropostas,
  resolveEntitlementsFromProfile,
  subscriptionUpgradeMessage,
} from "./subscriptionEntitlements";

export type StatusProposta = "rascunho" | "em_redacao" | "revisao" | "submetida" | "aprovada" | "rejeitada";

export interface Proposta {
  id: string;
  edital_id: string;
  user_id: string;
  status: StatusProposta;
  progresso: number;
  campos_formulario: Record<string, any>;
  observacoes?: string | null;
  proxima_etapa?: string | null;
  gerado_com_ia: boolean;
  ultima_versao_ia?: string | null;
  criado_em: string;
  atualizado_em: string;
  
  // Dados relacionados (join)
  edital_titulo?: string;
  edital_orgao?: string;
  edital_valor?: string;
  edital_fonte?: string;
}

/**
 * Busca todas as propostas do usuário logado
 */
export async function fetchPropostas(userId: string): Promise<Proposta[]> {
  const out = await apiFetch<{ rows: Proposta[] }>("/api/propostas", { method: "GET" });
  return out.rows || [];
}

/**
 * Busca uma proposta específica por ID
 */
export async function fetchPropostaById(propostaId: string, userId: string): Promise<Proposta | null> {
  try {
    const out = await apiFetch<{ row: Proposta }>(`/api/propostas/${encodeURIComponent(propostaId)}`, { method: "GET" });
    return out.row ?? null;
  } catch (e) {
    return null;
  }
}

/** Busca com retentativas curtas (útil logo após criar a proposta). */
export async function fetchPropostaByIdWithRetry(
  propostaId: string,
  userId: string,
  attempts = 4,
): Promise<Proposta | null> {
  for (let i = 0; i < attempts; i++) {
    const row = await fetchPropostaById(propostaId, userId);
    if (row) return row;
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
  return null;
}

/**
 * Verifica se já existe proposta para um edital (sem listar todas).
 */
export async function fetchPropostaByEdital(userId: string, editalId: string): Promise<Proposta | null> {
  try {
    const out = await apiFetch<{ rows: Proposta[] }>(
      `/api/propostas?edital_id=${encodeURIComponent(editalId)}`,
      { method: "GET" },
    );
    return out.rows?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Cria uma nova proposta (gerada por IA ou rascunho)
 */
export async function createProposta(
  editalId: string,
  userId: string,
  camposIniciais?: Record<string, any>
): Promise<Proposta> {
  const out = await apiFetch<{ row: Proposta }>("/api/propostas", {
    method: "POST",
    body: JSON.stringify({ edital_id: editalId, campos_formulario: camposIniciais || {}, gerado_com_ia: !!camposIniciais }),
  });
  return out.row;
}

/**
 * Atualiza uma proposta existente
 */
export async function updateProposta(
  propostaId: string,
  userId: string,
  updates: {
    campos_formulario?: Record<string, any>;
    status?: StatusProposta;
    progresso?: number;
    observacoes?: string;
    proxima_etapa?: string;
  }
): Promise<Proposta> {
  // Validar e normalizar progresso se fornecido
  const normalizedUpdates = { ...updates };
  if (normalizedUpdates.progresso !== undefined) {
    let progresso = Number(normalizedUpdates.progresso);
    // Garantir que está entre 0 e 100
    progresso = Math.max(0, Math.min(100, progresso));
    // Garantir que não seja NaN
    if (isNaN(progresso)) {
      progresso = 0;
    }
    normalizedUpdates.progresso = Math.round(progresso);
  }

  const out = await apiFetch<{ row: Proposta }>(`/api/propostas/${encodeURIComponent(propostaId)}`, {
    method: "PATCH",
    body: JSON.stringify(normalizedUpdates),
  });
  return out.row;
}

/**
 * Deleta uma proposta
 */
export async function deleteProposta(propostaId: string, userId: string): Promise<void> {
  await apiFetch(`/api/propostas/${encodeURIComponent(propostaId)}`, { method: "DELETE" });
}

/**
 * Gera proposta inicial (sem IA por enquanto)
 * Cria uma proposta vazia que o usuário pode preencher manualmente
 */
export async function gerarPropostaComIA(
  editalId: string,
  userId: string,
  user: any,
  profile: any
): Promise<Proposta> {
  const entitlements = profile?.entitlements ?? resolveEntitlementsFromProfile(profile);
  if (!canUsePropostas(entitlements)) {
    throw new Error(subscriptionUpgradeMessage("propostas"));
  }

  try {
    // Verificar se já existe uma proposta para este edital
    const existing = await fetchPropostaByEdital(userId, editalId);
    if (existing) return existing;

    // Criar proposta vazia no banco com estrutura completa do formulário
    const camposFormulario = createEmptyPropostaForm();
    const proposta = await createProposta(editalId, userId, camposFormulario as any);

    // Atualizar progresso inicial (já validado dentro de updateProposta)
    await updateProposta(proposta.id, userId, {
      progresso: 0,
      proxima_etapa: "Preencher os campos do formulário",
    });

    return proposta;
  } catch (error) {
    console.error("Erro ao criar proposta:", error);
    throw error;
  }
}

