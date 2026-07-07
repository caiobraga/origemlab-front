import { supabase } from "./supabase";

const ACCESS_TOKEN_KEY = "origemlab_api_access_token";
const ACCESS_TOKEN_EXP_KEY = "origemlab_api_access_exp";

function readApiBaseUrl(): string {
  return String((import.meta as any).env?.VITE_API_BASE_URL || "").replace(/\/$/, "");
}

function apiUrl(path: string) {
  const normalized = readApiBaseUrl();
  return normalized ? `${normalized}${path}` : path;
}

function normalizeExpiresAtMs(value?: number): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  // Supabase/backend podem enviar segundos (~1.7e9) ou ms (~1.7e12).
  return value < 1e12 ? value * 1000 : value;
}

export function setStoredAccessToken(token: string | null, expiresAtMs?: number) {
  if (!token) {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(ACCESS_TOKEN_EXP_KEY);
    return;
  }
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  const expMs = normalizeExpiresAtMs(expiresAtMs);
  if (expMs) sessionStorage.setItem(ACCESS_TOKEN_EXP_KEY, String(expMs));
  else sessionStorage.removeItem(ACCESS_TOKEN_EXP_KEY);
}

function readStoredAccessToken(): string | null {
  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) return null;
  const expRaw = sessionStorage.getItem(ACCESS_TOKEN_EXP_KEY);
  if (expRaw) {
    const exp = normalizeExpiresAtMs(Number(expRaw));
    if (exp && exp <= Date.now() + 5_000) {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      sessionStorage.removeItem(ACCESS_TOKEN_EXP_KEY);
      return null;
    }
  }
  return token;
}

/** Texto de ajuda quando falha conexão com a API (dev vs produção). */
export function getApiConnectionHelpMessage(): string {
  const apiBase = readApiBaseUrl();
  if (import.meta.env.DEV && !apiBase) {
    return "Se a sessão expirou, saia e entre de novo. Em desenvolvimento local, confira se o backend está rodando em localhost:8081.";
  }
  if (apiBase) {
    const frontOrigin = typeof window !== "undefined" ? window.location.origin : "";
    const corsHint =
      frontOrigin && frontOrigin !== apiBase
        ? ` O domínio do site (${frontOrigin}) precisa estar em CORS_ALLOW_ORIGIN / FRONT_ORIGINS no backend.`
        : "";
    return `Se a sessão expirou, saia e entre de novo. Se persistir, verifique se a API está acessível (${apiBase}).${corsHint}`;
  }
  return "Se a sessão expirou, saia e entre de novo. Se persistir, tente novamente em alguns instantes.";
}

let syncInflight: Promise<boolean> | null = null;

async function supabaseAuthHeader(): Promise<Record<string, string>> {
  let { data } = await supabase.auth.getSession();
  let session = data.session;
  if (session?.expires_at && session.expires_at * 1000 < Date.now() + 60_000) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session ?? session;
  }
  const token = session?.access_token || readStoredAccessToken();
  if (session?.access_token) {
    setStoredAccessToken(
      session.access_token,
      session.expires_at ? session.expires_at * 1000 : undefined,
    );
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Cria cookie de sessão no backend a partir da sessão Supabase do browser. */
export async function syncBackendSessionFromSupabase(): Promise<boolean> {
  if (syncInflight) return syncInflight;

  syncInflight = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const accessToken = session?.access_token || readStoredAccessToken();
      if (!accessToken) return false;

      const expiresAtMs = session?.expires_at
        ? session.expires_at * 1000
        : Number(sessionStorage.getItem(ACCESS_TOKEN_EXP_KEY)) ||
          Date.now() + (session?.expires_in ?? 3600) * 1000;

      const res = await fetch(apiUrl("/api/auth/sync-supabase"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          accessToken,
          refreshToken: session?.refresh_token ?? "",
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
    if (text.trimStart().startsWith("<")) {
      throw new Error(
        "Resposta inválida da API (HTML/XML). Confira VITE_API_BASE_URL e se o domínio do site está em CORS_ALLOW_ORIGIN no backend.",
      );
    }
    throw new Error(`Resposta inválida do servidor (HTTP ${status}).`);
  }
}

function wrapFetchError(err: unknown): Error {
  if (err instanceof Error && /Failed to fetch|NetworkError|Load failed/i.test(err.message)) {
    return new Error(
      `Não foi possível conectar à API (${readApiBaseUrl() || "URL não configurada"}). ${getApiConnectionHelpMessage()}`,
    );
  }
  return err instanceof Error ? err : new Error(String(err));
}

export async function apiUploadFile<T>(path: string, file: File, fieldName = "file"): Promise<T> {
  const authHeader = await supabaseAuthHeader();
  const form = new FormData();
  form.append(fieldName, file, file.name);

  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: "POST",
      credentials: "include",
      headers: authHeader,
      body: form,
    });
  } catch (err) {
    throw wrapFetchError(err);
  }

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

/** Garante Bearer/cookie antes de chamadas autenticadas. */
export async function ensureApiAuth(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (session?.access_token) {
    setStoredAccessToken(
      session.access_token,
      session.expires_at ? session.expires_at * 1000 : undefined,
    );
    await syncBackendSessionFromSupabase();
    return;
  }
  const stored = readStoredAccessToken();
  if (stored) {
    await syncBackendSessionFromSupabase();
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit, retryCount = 0): Promise<T> {
  if (retryCount === 0 && !/^\/api\/auth\/(sign-in|sign-up|sign-out)$/.test(path)) {
    await ensureApiAuth();
  }
  const authHeader = await supabaseAuthHeader();
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
        ...(init?.headers || {}),
      },
    });
  } catch (err) {
    throw wrapFetchError(err);
  }

  const text = await res.text();
  const json = parseJsonBody(text, res.status);

  if (!res.ok) {
    const isUnauthenticated = res.status === 401 && (json as any)?.error === "unauthenticated";
    const isPublicAuthRoute = /^\/api\/auth\/(sign-in|sign-up|sign-out)$/.test(path);
    if (isUnauthenticated && !isPublicAuthRoute && retryCount < 2) {
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
      setStoredAccessToken(null);
      throw new Error("Sessão expirada. Faça login novamente.");
    }
    throw new Error(msg);
  }
  return json as T;
}

/** Persiste token retornado pelo POST /api/auth/sign-in (fallback quando cookie cross-site falha). */
export function persistSignInResponse(body: unknown) {
  if (!body || typeof body !== "object") return;
  const accessToken = (body as any).accessToken;
  const expiresAtMs = (body as any).expiresAtMs;
  if (typeof accessToken === "string" && accessToken) {
    setStoredAccessToken(accessToken, Number(expiresAtMs) || undefined);
  }
}

/** POST/GET públicos de auth — sem Bearer (evita token expirado quebrar login). */
export async function authPublicFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
  } catch (err) {
    throw wrapFetchError(err);
  }

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

export async function syncBackendSessionFromAccessToken(input: {
  accessToken: string;
  refreshToken?: string;
  expiresAtMs?: number;
}): Promise<boolean> {
  const accessToken = String(input.accessToken || "").trim();
  if (!accessToken) return false;

  setStoredAccessToken(
    accessToken,
    input.expiresAtMs && Number.isFinite(input.expiresAtMs) ? input.expiresAtMs : undefined,
  );

  try {
    const expiresAtMs =
      input.expiresAtMs && Number.isFinite(input.expiresAtMs)
        ? input.expiresAtMs
        : Date.now() + 3600_000;

    const res = await fetch(apiUrl("/api/auth/sync-supabase"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        accessToken,
        refreshToken: input.refreshToken ?? "",
        expiresAtMs,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchBackendMe(): Promise<{ user: { id: string; email: string | null } | null } | null> {
  try {
    return await apiFetch<{ user: { id: string; email: string | null } | null }>("/api/auth/me", {
      method: "GET",
    });
  } catch {
    return null;
  }
}
