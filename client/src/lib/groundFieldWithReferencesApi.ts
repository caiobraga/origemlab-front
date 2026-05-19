import type { AnalyzeFieldParams } from "./analyzeFieldApi";

export type WebReference = {
  title: string;
  url: string;
  snippet: string;
};

export type GroundFieldStep = {
  step: string;
  detail: string;
};

export interface GroundFieldResponse {
  grounded_text: string;
  references: WebReference[];
  steps?: GroundFieldStep[];
  search_queries?: string[];
}

const API_BASE = String((import.meta as any).env?.VITE_API_BASE_URL || "").replace(/\/$/, "");
function apiUrl(path: string) {
  if (!API_BASE) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { supabase } = await import("./supabase");
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token || null;
  return {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

/** Pipeline: identificar afirmações → busca web → reescrita com prompt original + referências. */
export async function groundFieldWithReferences(
  params: AnalyzeFieldParams,
): Promise<GroundFieldResponse> {
  const body: Record<string, unknown> = {
    field_id: params.field_id ?? null,
    field_name: params.field_name,
    field_description: params.field_description,
    current_text: params.current_text ?? "",
    word_limit: params.word_limit ?? null,
    char_limit: params.char_limit ?? null,
    form_data: params.form_data ?? null,
    target_language: params.target_language ?? null,
  };
  if (params.edital_id) body.edital_id = params.edital_id;
  if (params.proposta_id) body.proposta_id = params.proposta_id;
  if (!body.edital_id && !body.proposta_id) {
    throw new Error("É necessário edital_id ou proposta_id.");
  }

  const response = await fetch(apiUrl("/api/ground-field-with-references"), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any).error || "Erro ao embasar com referências");
  }

  return (await response.json()) as GroundFieldResponse;
}

export function fieldSuggestsScientificGrounding(fieldDescription: string): boolean {
  return /refer[êe]ncia|bibliogr|embasamento|embasar|fundamenta[cç][ãa]o|cient[ií]fic|artigo|evid[eê]ncia|literatura|estado\s+da\s+arte|scholar|pubmed/i.test(
    String(fieldDescription || ""),
  );
}
