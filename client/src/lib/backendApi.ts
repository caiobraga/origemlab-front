import { supabase } from "./supabase";

function apiUrl(path: string) {
  const base = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  const normalized = base ? String(base).replace(/\/$/, "") : "";
  return normalized ? `${normalized}${path}` : path;
}

let syncInflight: Promise<boolean> | null = null;

async function supabaseAuthHeader(): Promise<Record<string, string>> {
  let { data } = await supabase.auth.getSession();
  let session = data.session;
  if (session?.expires_at && session.expires_at * 1000 < Date.now() + 60_000) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session ?? session;
  }
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Cria cookie de sessão no backend a partir da sessão Supabase do browser. */
export async function syncBackendSessionFromSupabase(): Promise<boolean> {
  if (syncInflight) return syncInflight;

  syncInflight = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.access_token) return false;

      const expiresAtMs = session.expires_at
        ? session.expires_at * 1000
        : Date.now() + (session.expires_in ?? 3600) * 1000;

      const res = await fetch(apiUrl("/api/auth/sync-supabase"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAtMs,
        }),
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      syncInflight = null;
    }
  })();

  return syncInflight;
}

function parseJsonBody(text: string, status: number): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Resposta inválida do servidor (HTTP ${status}).`);
  }
}

export async function apiUploadFile<T>(path: string, file: File, fieldName = "file"): Promise<T> {
  const authHeader = await supabaseAuthHeader();
  const form = new FormData();
  form.append(fieldName, file, file.name);

  const res = await fetch(apiUrl(path), {
    method: "POST",
    credentials: "include",
    headers: authHeader,
    body: form,
  });

  const text = await res.text();
  const json = parseJsonBody(text, res.status);

  if (!res.ok) {
    const msg =
      (json && typeof (json as any).message === "string" && (json as any).message) ||
      (json && typeof (json as any).error === "string" && (json as any).error) ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

export async function apiFetch<T>(path: string, init?: RequestInit, retryCount = 0): Promise<T> {
  const authHeader = await supabaseAuthHeader();
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  const json = parseJsonBody(text, res.status);

  if (!res.ok) {
    const isUnauthenticated = res.status === 401 && (json as any)?.error === "unauthenticated";
    if (isUnauthenticated && retryCount < 2) {
      if (retryCount === 0) {
        await syncBackendSessionFromSupabase();
      } else {
        await supabase.auth.refreshSession();
      }
      return apiFetch<T>(path, init, retryCount + 1);
    }

    const msg =
      (json && typeof (json as any).message === "string" && (json as any).message) ||
      (json && typeof (json as any).error === "string" && (json as any).error) ||
      `HTTP ${res.status}`;
    if (isUnauthenticated) {
      throw new Error("Sessão expirada. Faça login novamente.");
    }
    throw new Error(msg);
  }
  return json as T;
}
