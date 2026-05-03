import { nanoid } from "nanoid";
import { apiFetch } from "./backendApi";

const REFERRAL_STORAGE_KEY = "originlab_referral_code";
const CREDITO_POR_CONVERSAO = 50;

/**
 * Armazena o código de referência quando alguém visita /ref/:code
 */
export function storeReferralCode(code: string): void {
  try {
    localStorage.setItem(REFERRAL_STORAGE_KEY, code);
  } catch (e) {
    console.warn("Não foi possível salvar código de referência:", e);
  }
}

/**
 * Obtém o código de referência armazenado (se houver)
 */
export function getStoredReferralCode(): string | null {
  try {
    return localStorage.getItem(REFERRAL_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Remove o código de referência após processar
 */
export function clearStoredReferralCode(): void {
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {}
}

/**
 * Gera código determinístico a partir do userId (fallback quando DB não tem a coluna)
 */
function fallbackCodeFromUserId(userId: string): string {
  return userId.replace(/-/g, "").slice(0, 8);
}

/**
 * Gera ou obtém o código de referência do usuário
 */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  // Temporário: ainda gera localmente, e o backend pode persistir via /api/profile depois
  return nanoid(8);
}

/**
 * Registra uma conversão de referência (chamado após signup)
 */
export async function recordReferralConversion(
  referrerUserId: string,
  referredUserId: string
): Promise<boolean> {
  // TODO: mover para endpoint dedicado quando necessário
  return false;
}

/**
 * Busca referrer pelo código
 */
export async function getReferrerByCode(code: string): Promise<string | null> {
  return null;
}

/**
 * Busca estatísticas de referência do usuário
 */
export async function getReferralStats(userId: string): Promise<{
  convites: number;
  conversoes: number;
  ganhos: number;
  potencial: number;
}> {
  try {
    return await apiFetch("/api/referrals/stats", { method: "GET" });
  } catch {
    return { convites: 0, conversoes: 0, ganhos: 0, potencial: 0 };
  }
}

export { CREDITO_POR_CONVERSAO };
