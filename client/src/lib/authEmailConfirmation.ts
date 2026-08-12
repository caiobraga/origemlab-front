import { supabase } from "@/lib/supabase";

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
  return { error: error ? new Error(error.message) : null };
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
