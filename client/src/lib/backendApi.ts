import { supabase } from "./supabase";
import { USER_MESSAGES } from "./userMessages";

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
  return "Verifique sua conexão com a internet e tente novamente. Se persistir, saia e entre de novo.";
}

/** Dica técnica (somente console) para falhas de conexão/CORS com a API. */
function logApiConnectionDetails(context: string, detail: unknown) {
  const apiBase = readApiBaseUrl();
  const frontOrigin = typeof window !== "undefined" ? window.location.origin : "";
  console.error(
    `[api] ${context} (API: ${apiBase || "mesma origem"}; origem do site: ${frontOrigin}). ` +
      "Confira VITE_API_BASE_URL e se o domínio do site está em CORS_ALLOW_ORIGIN / FRONT_ORIGINS no backend.",
    detail,
  );
}

/** Códigos snake_case devolvidos pelo backend → texto para o usuário. */
const API_ERROR_CODE_MESSAGES: Record<string, string> = {
  subscription_required: "Este recurso faz parte do plano Pro. Assine para desbloquear.",
  subscription_limit: "Você atingiu o limite do plano gratuito. Assine o Pro para continuar.",
  account_blocked: "Sua conta está bloqueada. Entre em contato com o suporte.",
  unauthenticated: USER_MESSAGES.sessionExpired,
  invalid_token: USER_MESSAGES.sessionExpired,
  invalid_login: USER_MESSAGES.invalidLogin,
  no_bearer: "Faça login para continuar.",
  no_supabase: USER_MESSAGES.unavailable,
  supabase_unreachable: USER_MESSAGES.unavailable,
  ai_timeout: USER_MESSAGES.aiTimeout,
  internal_error: USER_MESSAGES.generic,
};

function messageForHttpStatus(status: number, opts?: { publicAuth?: boolean }): string {
  // Em sign-in/sign-up não há sessão: 401 é credencial inválida, não "sessão expirada".
  if (status === 401) return opts?.publicAuth ? USER_MESSAGES.invalidLogin : USER_MESSAGES.sessionExpired;
  if (status === 403) return "Você não tem permissão para realizar esta ação.";
  if (status === 404) return "O conteúdo solicitado não foi encontrado.";
  if (status === 413) return "O arquivo enviado é grande demais.";
  if (status === 429) return "Muitas solicitações em pouco tempo. Aguarde alguns instantes e tente novamente.";
  if (status === 502 || status === 503 || status === 504) return USER_MESSAGES.unavailable;
  return USER_MESSAGES.generic;
}

/**
 * Extrai uma mensagem amigável (pt-BR) do corpo de erro da API.
 * Prefere `message`, traduz códigos conhecidos em `error` e nunca mostra "HTTP 500".
 */
export function apiErrorMessage(json: unknown, status: number, opts?: { publicAuth?: boolean }): string {
  const body = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (message) return message;
  const error = typeof body?.error === "string" ? body.error.trim() : "";
  if (error) {
    if (/^[a-z][a-z0-9_]*$/.test(error)) return API_ERROR_CODE_MESSAGES[error] ?? messageForHttpStatus(status, opts);
    return error;
  }
  return messageForHttpStatus(status, opts);
}

/** Erro de API com mensagem segura (pt-BR) + status HTTP e código snake_case do backend, se houver. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(json: unknown, status: number, opts?: { publicAuth?: boolean }) {
    super(apiErrorMessage(json, status, opts));
    this.name = "ApiError";
    this.status = status;
    const error = json && typeof json === "object" ? (json as Record<string, unknown>).error : undefined;
    if (typeof error === "string" && /^[a-z][a-z0-9_]*$/.test(error)) this.code = error;
  }
}

/** A IA estourou o tempo limite no backend (HTTP 504 `{ error: "ai_timeout" }`). */
export function isAiTimeoutError(err: unknown): boolean {
  return err instanceof ApiError && err.code === "ai_timeout";
}

let syncInflight: Promise<boolean> | null = null;
/** Último access token aceito por /api/auth/sync-supabase (evita um POST antes de toda chamada). */
let lastSyncedToken: string | null = null;
let lastSyncedAtMs = 0;
const SYNC_REUSE_MS = 10 * 60_000;

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
      if (res.ok) {
        lastSyncedToken = accessToken;
        lastSyncedAtMs = Date.now();
      }
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
      logApiConnectionDetails(`Resposta HTML/XML em vez de JSON (HTTP ${status})`, text.slice(0, 300));
    } else {
      console.error(`[api] Resposta não-JSON (HTTP ${status}):`, text.slice(0, 300));
    }
    throw new Error(USER_MESSAGES.badResponse);
  }
}

function wrapFetchError(err: unknown): Error {
  if (err instanceof Error && /Failed to fetch|NetworkError|Load failed/i.test(err.message)) {
    logApiConnectionDetails("Falha de rede ao chamar a API", err);
    return new Error(USER_MESSAGES.offline);
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
    throw new ApiError(json, res.status);
  }
  return json as T;
}

function syncedRecently(token: string): boolean {
  return token === lastSyncedToken && Date.now() - lastSyncedAtMs < SYNC_REUSE_MS;
}

/**
 * Garante Bearer/cookie antes de chamadas autenticadas.
 * Só sincroniza o cookie quando o token mudou (ou há mais de 10 min); um 401 em apiFetch força nova sync.
 */
export async function ensureApiAuth(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (session?.access_token) {
    setStoredAccessToken(
      session.access_token,
      session.expires_at ? session.expires_at * 1000 : undefined,
    );
    if (!syncedRecently(session.access_token)) await syncBackendSessionFromSupabase();
    return;
  }
  const stored = readStoredAccessToken();
  if (stored && !syncedRecently(stored)) {
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

    if (isUnauthenticated) {
      setStoredAccessToken(null);
      throw new Error(USER_MESSAGES.sessionExpired);
    }
    throw new ApiError(json, res.status);
  }
  return json as T;
}

/**
 * POST que responde em NDJSON (uma linha JSON por evento).
 * Útil para progresso longo (ex.: gerar proposta a partir de projeto).
 */
export async function* apiFetchNdjson(
  path: string,
  init?: RequestInit,
): AsyncGenerator<Record<string, unknown>> {
  if (!/^\/api\/auth\/(sign-in|sign-up|sign-out)$/.test(path)) {
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

  if (!res.ok) {
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      if (text.trim()) console.error(`[api] Resposta não-JSON (HTTP ${res.status}):`, text.trim().slice(0, 300));
    }
    throw new ApiError(json, res.status);
  }

  if (!res.body) {
    console.error("[api] Resposta NDJSON sem corpo (stream indisponível).");
    throw new Error(USER_MESSAGES.generic);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        yield JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        // ignore malformed line
      }
    }
  }
  const tail = buffer.trim();
  if (tail) {
    try {
      yield JSON.parse(tail) as Record<string, unknown>;
    } catch {
      // ignore
    }
  }
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
    throw new ApiError(json, res.status, { publicAuth: true });
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
    if (res.ok) {
      lastSyncedToken = accessToken;
      lastSyncedAtMs = Date.now();
    }
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
