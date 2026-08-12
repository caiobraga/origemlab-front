import type { UserProfile } from "@/lib/userProfile";
import { saveUserProfile } from "@/lib/userProfile";

const PENDING_PROFILE_KEY = "origemlab_pending_signup_profile";

type PendingSignupProfile = {
  email: string;
  profile: UserProfile;
  savedAt: number;
};

/** Guarda CPF/tipo etc. quando o cadastro ainda não tem sessão (confirm email). */
export function stashPendingSignupProfile(email: string, profile: UserProfile): void {
  try {
    const payload: PendingSignupProfile = {
      email: email.trim().toLowerCase(),
      profile,
      savedAt: Date.now(),
    };
    localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function peekPendingSignupProfile(): PendingSignupProfile | null {
  try {
    const raw = localStorage.getItem(PENDING_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSignupProfile;
    if (!parsed?.email || !parsed?.profile) return null;
    // Expira em 7 dias
    if (Date.now() - (parsed.savedAt || 0) > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(PENDING_PROFILE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingSignupProfile(): void {
  try {
    localStorage.removeItem(PENDING_PROFILE_KEY);
  } catch {
    // ignore
  }
}

/** Após login/confirmação, grava o perfil que não pôde ser salvo no cadastro. */
export async function flushPendingSignupProfile(
  userId: string,
  email?: string | null,
): Promise<boolean> {
  const pending = peekPendingSignupProfile();
  if (!pending) return false;
  if (email && pending.email !== email.trim().toLowerCase()) {
    return false;
  }
  try {
    await saveUserProfile(userId, pending.profile);
    clearPendingSignupProfile();
    return true;
  } catch (e) {
    console.warn("Não foi possível aplicar perfil pendente do cadastro:", e);
    return false;
  }
}
