import { apiFetch } from "./backendApi";

export type Empresa = {
  id: string;
  owner_user_id: string;
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  area?: string | null;
  dados?: Record<string, unknown>;
  criado_em?: string;
  atualizado_em?: string;
};

export async function fetchEmpresas(): Promise<Empresa[]> {
  const data = await apiFetch<{ rows: Empresa[] }>("/api/empresas");
  return Array.isArray(data?.rows) ? data.rows : [];
}

export async function fetchEmpresa(id: string): Promise<Empresa> {
  const data = await apiFetch<{ row: Empresa }>(`/api/empresas/${id}`);
  if (!data?.row) throw new Error("Empresa não encontrada");
  return data.row;
}

export async function createEmpresa(input: {
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  area?: string | null;
}): Promise<Empresa> {
  const data = await apiFetch<{ row: Empresa }>("/api/empresas", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!data?.row) throw new Error("Falha ao criar empresa");
  return data.row;
}

export async function updateEmpresa(
  id: string,
  patch: Partial<Pick<Empresa, "razao_social" | "nome_fantasia" | "cnpj" | "area" | "dados">>,
): Promise<Empresa> {
  const data = await apiFetch<{ row: Empresa }>(`/api/empresas/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!data?.row) throw new Error("Falha ao atualizar empresa");
  return data.row;
}

export async function deleteEmpresa(id: string): Promise<void> {
  await apiFetch(`/api/empresas/${id}`, { method: "DELETE" });
}
