import { supabase } from "@/lib/supabase";
import {
  setStoredAccessToken,
  syncBackendSessionFromSupabase,
} from "@/lib/backendApi";

export type EmailOtpType =
  | "signup"
  | "email"
  | "recovery"
  | "invite"
  | "magiclink"
  | "email_change";

export type EstablishAuthSessionResult =
  | { ok: true; flow: "recovery" | "signup" | "other" }
  | { ok: false; error: string; pkceRecoveryHint?: boolean };

export const PENDING_AUTH_FLOW_KEY = "origemlab_pending_auth_flow";

const PKCE_RECOVERY_MSG =
  "Este link precisa ser aberto no mesmo navegador em que você clicou em «Esqueci a senha». " +
  "Copie o link do email e cole na barra de endereço desse navegador, ou peça um novo email nesse aparelho.";

const PKCE_SIGNUP_MSG =
  "Este link precisa ser aberto no mesmo navegador em que você criou a conta. " +
  "Copie o link do email e cole na barra de endereço desse navegador, ou peça um novo email de confirmação na tela de login.";

const PKCE_AMBIGUOUS_MSG =
  "Este link precisa ser aberto no mesmo navegador em que você pediu o email (cadastro ou «Esqueci a senha»). " +
  "Copie o link do email e cole na barra de endereço desse navegador, ou peça um novo email nesse aparelho.";

export function markPendingAuthFlow(flow: "recovery" | "signup"): void {
  try {
    sessionStorage.setItem(PENDING_AUTH_FLOW_KEY, flow);
    localStorage.setItem(PENDING_AUTH_FLOW_KEY, flow);
  } catch {
    /* ignore */
  }
}

export function peekPendingAuthFlow(): "recovery" | "signup" | null {
  try {
    for (const store of [sessionStorage, localStorage]) {
      const v = store.getItem(PENDING_AUTH_FLOW_KEY);
      if (v === "recovery" || v === "signup") return v;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function consumePendingAuthFlow(): "recovery" | "signup" | null {
  const v = peekPendingAuthFlow();
  if (v) {
    try {
      sessionStorage.removeItem(PENDING_AUTH_FLOW_KEY);
      localStorage.removeItem(PENDING_AUTH_FLOW_KEY);
    } catch {
      /* ignore */
    }
  }
  return v;
}

function hashParams(hash: string): URLSearchParams {
  return new URLSearchParams(String(hash || "").replace(/^#/, ""));
}

/** URL contém parâmetros de link de email do Supabase (confirmação ou recovery). */
export function hasAuthCallbackInUrl(url: URL = new URL(window.location.href)): boolean {
  if (url.searchParams.has("code")) return true;
  if (url.searchParams.has("token_hash")) return true;
  if (url.searchParams.has("token") && url.searchParams.has("email")) return true;
  if (url.searchParams.has("error") || url.searchParams.has("error_description")) return true;

  const hp = hashParams(url.hash);
  if (hp.has("access_token")) return true;
  if (hp.has("error")) return true;
  return false;
}

export function isSignupConfirmAuthUrl(url: URL = new URL(window.location.href)): boolean {
  const type = (url.searchParams.get("type") || "").toLowerCase();
  if (type === "signup" || type === "email" || type === "invite") return true;

  const hp = hashParams(url.hash);
  const hashType = (hp.get("type") || "").toLowerCase();
  if (hashType === "signup" || hashType === "email" || hashType === "invite") return true;

  if (peekPendingAuthFlow() === "signup") return true;
  return false;
}

/**
 * Heurística para links de recuperação.
 * Não trate `/redefinir-senha?code=` sozinho como recovery: confirmação de email
 * antiga também caía nessa rota e gerava a mensagem errada de «Esqueci a senha».
 */
export function isRecoveryAuthUrl(url: URL = new URL(window.location.href)): boolean {
  if (isSignupConfirmAuthUrl(url)) return false;

  const type = (url.searchParams.get("type") || "").toLowerCase();
  if (type === "recovery") return true;

  const hp = hashParams(url.hash);
  if ((hp.get("type") || "").toLowerCase() === "recovery") return true;

  return peekPendingAuthFlow() === "recovery";
}

/** /redefinir-senha com ?code= sem type — pode ser confirm antigo ou reset. */
export function isAmbiguousAuthLinkUrl(url: URL = new URL(window.location.href)): boolean {
  if (isSignupConfirmAuthUrl(url) || isRecoveryAuthUrl(url)) return false;
  const path = url.pathname.replace(/\/$/, "") || "/";
  return path === "/redefinir-senha" && hasAuthCallbackInUrl(url);
}

/** Se o link caiu na home (Site URL), redireciona para a rota que processa o token. */
export function getAuthCallbackRedirectPath(url: URL = new URL(window.location.href)): string | null {
  if (!hasAuthCallbackInUrl(url)) return null;

  const pathname = url.pathname.replace(/\/$/, "") || "/";
  if (pathname === "/auth/callback" || pathname === "/redefinir-senha") return null;

  const qs = url.search + url.hash;
  if (isRecoveryAuthUrl(url)) return `/redefinir-senha${qs}`;
  return `/auth/callback${qs}`;
}

/** Redirect síncrono antes do React montar (evita Home redirecionar usuário logado). */
export function redirectAuthLinkIfNeeded(): boolean {
  if (typeof window === "undefined") return false;
  const target = getAuthCallbackRedirectPath();
  if (!target) return false;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current === target) return false;
  window.location.replace(target);
  return true;
}

function isPkceVerifierError(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message || "").toLowerCase();
  const name = String((error as { name?: string })?.name || "").toLowerCase();
  return (
    name.includes("pkce") ||
    msg.includes("code verifier") ||
    msg.includes("both auth code and code verifier") ||
    msg.includes("pkce code verifier not found")
  );
}

/**
 * Mensagens amigáveis para links inválidos (conta excluída, token usado/expirado, etc.).
 * Nunca expor o texto bruto do Supabase na UI.
 */
export function humanizeAuthLinkError(
  error: unknown,
  opts?: { recovery?: boolean; ambiguous?: boolean },
): string {
  const ambiguous = opts?.ambiguous === true;
  // default: recovery messaging (histórico). Passe recovery:false para confirmação de email.
  const recovery = ambiguous ? true : opts?.recovery !== false;
  const raw =
    typeof error === "string"
      ? error
      : String(
          (error as { message?: string; error_description?: string })?.message ||
            (error as { error_description?: string })?.error_description ||
            "",
        );
  const n = raw.toLowerCase();
  const code = String((error as { code?: string })?.code || "").toLowerCase();

  if (isPkceVerifierError(error) || n.includes("code verifier")) {
    if (ambiguous) return PKCE_AMBIGUOUS_MSG;
    if (opts?.recovery === false) return PKCE_SIGNUP_MSG;
    return PKCE_RECOVERY_MSG;
  }

  if (
    code === "user_not_found" ||
    n.includes("user not found") ||
    n.includes("user_not_found") ||
    n.includes("no user found") ||
    n.includes("user does not exist")
  ) {
    return recovery
      ? "Este link não é mais válido. A conta pode ter sido removida. Crie uma nova conta em Cadastro ou fale com o suporte."
      : "Este link não é mais válido. Crie uma nova conta ou fale com o suporte.";
  }

  if (
    n.includes("expired") ||
    n.includes("otp_expired") ||
    code === "otp_expired" ||
    n.includes("token has expired") ||
    n.includes("flow state") ||
    n.includes("invalid flow")
  ) {
    if (ambiguous) {
      return "Este link expirou ou já foi usado. Peça um novo email de confirmação na tela de login ou um novo link em «Esqueci a senha».";
    }
    return recovery
      ? "Este link expirou ou já foi usado. Solicite um novo em «Esqueci a senha» ou cadastre-se novamente."
      : "Este link expirou ou já foi usado. Peça um novo email na tela de login.";
  }

  if (
    n.includes("invalid") ||
    n.includes("otp") ||
    n.includes("token") ||
    n.includes("auth code") ||
    n.includes("session") ||
    code === "access_denied"
  ) {
    if (ambiguous) {
      return "Não foi possível validar este link. Tente reenviar o email na tela de login ou pedir outro em «Esqueci a senha».";
    }
    return recovery
      ? "Não foi possível validar este link. Solicite um novo em «Esqueci a senha» ou cadastre-se novamente."
      : "Não foi possível validar este link. Tente reenviar o email na tela de login.";
  }

  if (ambiguous) {
    return "Este link não pode ser usado. Tente entrar, reenviar a confirmação ou recuperar a senha.";
  }

  return recovery
    ? "Este link não pode ser usado. Solicite um novo em «Esqueci a senha» ou crie uma nova conta."
    : "Este link não pode ser usado. Tente entrar ou criar uma nova conta.";
}

function failAuthLink(
  error: unknown,
  recovery: boolean,
  ambiguous = false,
): EstablishAuthSessionResult {
  return {
    ok: false,
    error: humanizeAuthLinkError(error, { recovery, ambiguous }),
    pkceRecoveryHint: isPkceVerifierError(error),
  };
}

async function persistSessionFromClient(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) return false;
  setStoredAccessToken(
    data.session.access_token,
    data.session.expires_at ? data.session.expires_at * 1000 : undefined,
  );
  try {
    await syncBackendSessionFromSupabase();
  } catch {
    /* ignore */
  }
  return true;
}

/** Troca ?code= / token_hash / #access_token por sessão Supabase. */
export async function establishAuthSessionFromUrl(
  url: URL = new URL(window.location.href),
): Promise<EstablishAuthSessionResult> {
  const hasLinkParams = hasAuthCallbackInUrl(url);
  const recoveryContext = isRecoveryAuthUrl(url);
  const ambiguousContext = isAmbiguousAuthLinkUrl(url);
  const fail = (error: unknown) => failAuthLink(error, recoveryContext, ambiguousContext);

  if (!hasLinkParams) {
    if (await persistSessionFromClient()) {
      return { ok: true, flow: recoveryContext ? "recovery" : "other" };
    }
    return fail("Link inválido ou expirado.");
  }

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const otpToken = url.searchParams.get("token");
  const emailParam = url.searchParams.get("email");
  const typeRaw = (url.searchParams.get("type") || "").toLowerCase();
  const type = (typeRaw || (recoveryContext ? "recovery" : "signup")) as EmailOtpType;
  const hp = hashParams(url.hash);
  const hashType = (hp.get("type") || "").toLowerCase();

  let passwordRecoveryEvent = false;
  let listener: { subscription: { unsubscribe: () => void } } | null = null;

  try {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") passwordRecoveryEvent = true;
    });
    listener = data;

    if (tokenHash) {
      const otpType = (typeRaw || hashType || (recoveryContext ? "recovery" : "signup")) as EmailOtpType;
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType,
      });
      if (error) {
        if ((recoveryContext || ambiguousContext) && otpType !== "recovery") {
          const retry = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (retry.error) return fail(retry.error);
        } else if (!recoveryContext && otpType === "recovery") {
          const retry = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "signup",
          });
          if (retry.error) return fail(error);
        } else {
          return fail(error);
        }
      }
    } else if (otpToken && emailParam) {
      const { error } = await supabase.auth.verifyOtp({
        email: emailParam,
        token: otpToken,
        type,
      });
      if (error) return fail(error);
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        if (isPkceVerifierError(error)) {
          return fail(error);
        }
        if (!(await persistSessionFromClient())) {
          return fail(error);
        }
      }
    } else if (hp.has("access_token") && hp.has("refresh_token")) {
      const { error } = await supabase.auth.setSession({
        access_token: hp.get("access_token")!,
        refresh_token: hp.get("refresh_token")!,
      });
      if (error) return fail(error);
    } else if (url.searchParams.has("error") || hp.has("error")) {
      const desc =
        url.searchParams.get("error_description") ||
        hp.get("error_description") ||
        url.searchParams.get("error") ||
        "Link inválido.";
      return fail(desc);
    } else {
      return fail("Link inválido ou expirado.");
    }

    await new Promise((r) => setTimeout(r, 150));

    if (!(await persistSessionFromClient())) {
      return fail("Sessão inválida ou expirada. Peça um novo link.");
    }

    const pending = consumePendingAuthFlow();

    // Não use só o path /redefinir-senha: confirmação de email antiga apontava pra cá.
    const flow: "recovery" | "signup" | "other" =
      passwordRecoveryEvent ||
      typeRaw === "recovery" ||
      hashType === "recovery" ||
      pending === "recovery"
        ? "recovery"
        : typeRaw === "signup" ||
            typeRaw === "email" ||
            typeRaw === "invite" ||
            hashType === "signup" ||
            hashType === "email" ||
            pending === "signup"
          ? "signup"
          : "other";

    return { ok: true, flow };
  } catch (e) {
    console.warn("Auth link establish failed:", e);
    return fail(e);
  } finally {
    listener?.subscription.unsubscribe();
  }
}

export function stripAuthParamsFromPath(pathname = "/redefinir-senha"): void {
  window.history.replaceState({}, "", pathname);
}
