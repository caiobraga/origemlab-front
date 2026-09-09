import { supabase } from "@/lib/supabase";
import { markPendingAuthFlow } from "@/lib/authCallbackUrl";

/**
 * Base URL do front para links de confirmação.
 * Prefira VITE_APP_BASE_URL em produção (domínio canônico no allowlist do Supabase).
 */
export function getAppOrigin(): string {
  const configured = String(import.meta.env.VITE_APP_BASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "";
}

/**
 * URL para onde o Supabase redireciona após o usuário clicar no link do email.
 * Deve estar em Authentication → URL Configuration → Redirect URLs.
 */
export function getEmailConfirmRedirectUrl(): string {
  const origin = getAppOrigin();
  return origin ? `${origin}/auth/callback` : "/auth/callback";
}

/** Redirect do email de recuperação de senha (allowlist no Supabase). */
export function getPasswordResetRedirectUrl(): string {
  const origin = getAppOrigin();
  // Site URL do Supabase costuma ser a home — main.tsx redireciona ?code= para /redefinir-senha.
  return origin ? `${origin}/redefinir-senha` : "/redefinir-senha";
}

function smtpAwareError(error: { message?: string } | null): Error | null {
  if (!error) return null;
  const msg = error.message || "Falha ao enviar email";
  if (/smtp|mail|535|auth/i.test(msg)) {
    return new Error(
      `Falha no envio (SMTP): ${msg}. Verifique Authentication → SMTP no Supabase (Gmail costuma falhar; use Resend).`,
    );
  }
  return new Error(msg);
}

export async function resendSignupConfirmationEmail(
  email: string,
): Promise<{ error: Error | null }> {
  const trimmed = email.trim();
  if (!trimmed) {
    return { error: new Error("Informe seu email.") };
  }
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: trimmed,
    options: {
      emailRedirectTo: getEmailConfirmRedirectUrl(),
    },
  });
  if (!error) markPendingAuthFlow("signup");
  return { error: smtpAwareError(error) };
}

export async function requestPasswordResetEmail(
  email: string,
): Promise<{ error: Error | null }> {
  const trimmed = email.trim();
  if (!trimmed) {
    return { error: new Error("Informe seu email.") };
  }
  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
    redirectTo: getPasswordResetRedirectUrl(),
  });
  return { error: smtpAwareError(error) };
}

/**
 * Supabase às vezes “cria” um user fantasma sem identities quando o email já existe
 * (proteção anti-enumeração) e não reenvia o email de confirmação.
 */
export function isLikelyExistingUnconfirmedSignup(user: {
  identities?: unknown[] | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
} | null): boolean {
  if (!user) return false;
  const identities = user.identities;
  return Array.isArray(identities) && identities.length === 0;
}
