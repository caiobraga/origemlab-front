import { USER_MESSAGES } from "@/lib/userMessages";

/**
 * Traduz erros do Supabase Auth / da nossa API de auth para pt-BR.
 * Os console.error/warn aqui são intencionais: há muitos call sites e o detalhe técnico (SMTP, chave,
 * mensagem não traduzida) só aparece neste ponto — nunca na mensagem devolvida ao usuário.
 */
export function translateSupabaseAuthError(
  error: unknown,
  fallbackMessage = "Ocorreu um erro. Tente novamente."
): string {
  const msg =
    (error as any)?.message ??
    (error as any)?.error_description ??
    (error as any)?.error ??
    "";

  const code = ((error as any)?.code ?? (error as any)?.error_code ?? "") as string;

  const raw = String(msg || "").trim();
  const normalized = raw.toLowerCase();
  const normalizedCode = String(code || "").toLowerCase();

  if (
    normalizedCode === "email_not_confirmed" ||
    normalized.includes("email not confirmed") ||
    normalized.includes("confirm your email") ||
    normalized.includes("email address is not confirmed")
  ) {
    return "Seu email ainda não foi confirmado no servidor. Se você já clicou no link, use «Reenviar email» na tela de login e abra o novo link neste mesmo navegador (não no app do email). Ou tente entrar de novo — às vezes a confirmação já valeu.";
  }

  if (
    normalizedCode === "invalid_login_credentials" ||
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid credentials")
  ) {
    return USER_MESSAGES.invalidLogin;
  }

  if (
    normalizedCode === "user_already_exists" ||
    normalized.includes("user already registered") ||
    normalized.includes("already registered")
  ) {
    return "Já existe uma conta com este email.";
  }

  const passwordPolicy = translatePasswordPolicy(raw);
  if (passwordPolicy) return passwordPolicy;

  if (
    normalized.includes("same password") ||
    normalized.includes("should be different from the old password")
  ) {
    return "A nova senha precisa ser diferente da atual.";
  }

  if (normalized.includes("signup requires a valid password")) {
    return "Informe uma senha válida (mínimo de 6 caracteres).";
  }

  if (
    normalizedCode === "email_address_invalid" ||
    normalized.includes("email address is invalid") ||
    normalized.includes("invalid email") ||
    normalized.includes("unable to validate email address")
  ) {
    return "E-mail inválido. Confira o endereço digitado.";
  }

  if (
    normalizedCode === "weak_password" ||
    normalized.includes("password is known to be weak") ||
    normalized.includes("weak password")
  ) {
    return "Essa senha é fraca ou muito comum. Escolha uma senha diferente.";
  }

  if (
    normalizedCode === "otp_expired" ||
    normalized.includes("email link is invalid or has expired") ||
    normalized.includes("token has expired or is invalid")
  ) {
    return "O link do e-mail é inválido ou expirou. Solicite um novo link.";
  }

  const waitMatch = raw.match(/only request this after (\d+) seconds?/i);
  if (waitMatch || normalizedCode === "over_request_rate_limit") {
    return waitMatch
      ? `Aguarde ${waitMatch[1]} segundos antes de pedir novamente.`
      : "Aguarde alguns segundos antes de pedir novamente.";
  }

  if (
    normalized.includes("error sending") ||
    normalized.includes("unable to send") ||
    /\bsmtp\b|\b535\b/.test(normalized)
  ) {
    // Detalhe técnico só no console (ex.: SMTP do Supabase falhando; configurar Resend em Authentication → SMTP).
    console.error("[auth] Falha no envio de e-mail (SMTP do Supabase):", raw);
    return USER_MESSAGES.emailSendFailed;
  }

  if (normalized.includes("too many requests") || normalized.includes("rate limit") || normalized.includes("email rate limit exceeded")) {
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }

  if (normalized.includes("signup is disabled")) {
    return "Cadastro desabilitado no momento.";
  }

  if (normalized.includes("jwt expired") || normalizedCode === "session_expired") {
    return USER_MESSAGES.sessionExpired;
  }

  // Problemas de configuração/infra (chave, URL, Worker sem acesso ao Supabase): detalhe só no console.
  if (
    normalized.includes("invalid api key") ||
    normalized.includes("jwt") ||
    normalized.includes("invalid url") ||
    normalized === "fetch failed" ||
    normalized.includes("supabase network")
  ) {
    console.error("[auth] Erro de configuração/conexão com o Supabase:", raw);
    return USER_MESSAGES.unavailable;
  }

  if (normalized.includes("failed to fetch") || normalized.includes("networkerror") || normalized.includes("load failed")) {
    return USER_MESSAGES.offline;
  }

  // Mensagens já em português (ex.: vindas do nosso backend) seguem como estão; inglês desconhecido → fallback.
  if (raw && looksPortuguese(raw)) return raw;
  if (raw) console.warn("[auth] Mensagem de erro não traduzida:", raw);
  return fallbackMessage;
}

/**
 * Política de senha do Supabase ("Password should be at least N characters",
 * "Password should contain at least one character of each: …") → requisito específico em pt-BR.
 */
function translatePasswordPolicy(raw: string): string | null {
  const minLength = raw.match(/password should be at least (\d+) characters?/i);
  if (minLength) return `A senha precisa ter pelo menos ${minLength[1]} caracteres.`;
  const eachOf = raw.match(/password should contain at least one character of each:?(.*)$/is);
  if (eachOf) {
    const policy = eachOf[1] ?? "";
    const parts: string[] = [];
    if (/[A-Z]{5,}/.test(policy)) parts.push("letras maiúsculas");
    if (/[a-z]{5,}/.test(policy)) parts.push("letras minúsculas");
    if (/\d{5,}/.test(policy)) parts.push("números");
    if (/[!@#$%^&*]/.test(policy)) parts.push("símbolos");
    return `A senha precisa ter ${joinPtList(parts.length ? parts : ["letras maiúsculas", "letras minúsculas", "números", "símbolos"])}.`;
  }
  if (/password length/i.test(raw)) return "A senha deve ter pelo menos 6 caracteres.";
  return null;
}

function joinPtList(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

function looksPortuguese(text: string): boolean {
  return (
    /[áàâãéêíóôõúç]/i.test(text) ||
    /\b(informe|tente|entre|senha|conta|aguarde|servidor|novamente)\b/i.test(text)
  );
}

