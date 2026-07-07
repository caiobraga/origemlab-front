import { apiFetch } from "./backendApi";
import { supabase } from "./supabase";
import { type EntitlementsPayload, resolveEntitlementsFromProfile } from "./subscriptionEntitlements";
import type { User } from "@supabase/supabase-js";
type SessionUser = { id: string; user_metadata?: any } ;

function mapProfileRow(
  profile: Record<string, any>,
  entitlements?: EntitlementsPayload,
): UserProfile {
  const resolvedUserType = (profile.user_type || "pesquisador") as "pesquisador" | "pessoa-empresa" | "ambos";
  return {
    cpf: profile.cpf || undefined,
    cnpj: profile.cnpj || undefined,
    lattesId: profile.lattes_id || undefined,
    userType: resolvedUserType,
    hasCnpj: profile.has_cnpj || false,
    isAdmin: profile.is_admin ?? undefined,
    isBlocked: profile.is_blocked ?? undefined,
    sexo: profile.sexo ?? undefined,
    curriculumData: (profile.curriculum_data as CurriculumData) ?? undefined,
    onboardingCompleted: profile.onboarding_completed ?? undefined,
    phone: profile.phone ?? undefined,
    area: profile.area ?? undefined,
    stripeCustomerId: profile.stripe_customer_id ?? undefined,
    stripeSubscriptionId: profile.stripe_subscription_id ?? undefined,
    subscriptionStatus: profile.subscription_status ?? undefined,
    subscriptionPriceId: profile.subscription_price_id ?? undefined,
    subscriptionCurrentPeriodEnd: profile.subscription_current_period_end ?? undefined,
    subscriptionPlanKey: profile.subscription_plan_key ?? undefined,
    entitlements,
  };
}

async function getProfileFromSupabase(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error || !data) return null;
  const mapped = mapProfileRow(data as Record<string, any>);
  return {
    ...mapped,
    entitlements: resolveEntitlementsFromProfile(mapped),
  };
}

async function patchProfileWithFallback(userId: string, patch: Record<string, unknown>): Promise<void> {
  try {
    await apiFetch("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return;
  } catch (backendError) {
    const { error } = await supabase.from("profiles").upsert(
      { user_id: userId, ...patch },
      { onConflict: "user_id" },
    );
    if (error) throw backendError;
  }
}

/** Params para upsert_user_profile (versão com consentimento - 9 params, evita ambiguidade PGRST203). */
type UpsertRpcParams = {
  p_user_id: string;
  p_cpf: string | null;
  p_cnpj: string | null;
  p_lattes_id: string | null;
  p_user_type: string;
  p_has_cnpj: boolean;
  p_data_collection_consent?: boolean;
  p_consent_version?: string | null;
  p_consent_date?: string | null;
};

/** Chama upsert_user_profile com retry quando o backend retorna "User does not exist" (race pós-signUp). */
async function callUpsertRpcWithRetry(rpcParams: UpsertRpcParams): Promise<{ data: unknown; error: { code: string; message: string } | null }> {
  const { data, error } = await supabase.rpc('upsert_user_profile', rpcParams);
  if (!error) return { data, error: null };
  const isRaceCondition =
    error.code === 'P0001' ||
    error.code === '23503' ||
    (error.message && (error.message.includes('User does not exist') || error.message.includes('foreign key') || error.message.includes('violates foreign key')));
  if (isRaceCondition) {
    console.warn("⚠️ User not yet visible (race após signUp). Aguardando 2s e tentando novamente...");
    await new Promise((r) => setTimeout(r, 2000));
    const retry = await supabase.rpc('upsert_user_profile', rpcParams);
    return { data: retry.data, error: retry.error };
  }
  return { data, error };
}

/** Dados extraídos do currículo (PDF ou Lattes), usado para exibição e elegibilidade. */
export type CurriculumData = {
  id?: string;
  nome?: string;
  resumo?: string;
  areasAtuacao?: string[];
  formacao?: Array<{ nivel: string; curso: string; instituicao: string; anoConclusao?: string }>;
  elegibilidade?: { possuiDoutorado?: boolean; possuiMestrado?: boolean; possuiGraduacao?: boolean; podeParticiparEditais?: boolean; observacoes?: string[] };
  [key: string]: unknown;
};

export interface UserProfile {
  cpf?: string;
  cnpj?: string;
  lattesId?: string;
  userType: "pesquisador" | "pessoa-empresa" | "ambos";
  hasCnpj?: boolean;
  /** Sexo/gênero (opcional) para melhorar heurísticas de indicação. */
  sexo?: "masculino" | "feminino" | "outro" | "nao_informar";
  dataCollectionConsent?: boolean;
  consentVersion?: string;
  /** Dados do currículo extraídos de PDF (persistido em user_metadata). */
  curriculumData?: CurriculumData | null;
  /** Indica se o usuário já passou pelo onboarding (primeiro login). Controla redirecionamento para /onboarding. */
  onboardingCompleted?: boolean;
  /** Telefone (apenas números), coletado no onboarding. */
  phone?: string;
  /** Área de atuação principal (ex: tech, health), coletada no onboarding. */
  area?: string;
  /** Stripe + assinatura (colunas em `profiles`, preenchidas pelo webhook). */
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
  subscriptionPriceId?: string;
  subscriptionCurrentPeriodEnd?: string;
  subscriptionPlanKey?: string;
  /** Permissão administrativa (coluna em `profiles`). */
  isAdmin?: boolean;
  /** Bloqueio administrativo (coluna em `profiles`). */
  isBlocked?: boolean;
  /** Entitlements calculados no backend (limites de plano + uso mensal). */
  entitlements?: import("@/lib/subscriptionEntitlements").EntitlementsPayload;
}

/**
 * Salva o perfil do usuário após o cadastro
 * Agora salva na tabela profiles do banco de dados
 */
export async function saveUserProfile(
  userId: string,
  profile: UserProfile
): Promise<void> {
  // Backend owns persistence now (cookie session). Ignore userId from client.
  await apiFetch("/api/profile", {
    method: "PATCH",
    body: JSON.stringify({
      cpf: profile.cpf ? profile.cpf.replace(/\D/g, "") : null,
      cnpj: profile.cnpj ? profile.cnpj.replace(/\D/g, "") : null,
      lattes_id: profile.lattesId ? profile.lattesId.replace(/\D/g, "") : null,
      user_type: profile.userType,
      has_cnpj: profile.hasCnpj || false,
      data_collection_consent: profile.dataCollectionConsent ?? null,
      consent_version: profile.consentVersion ?? null,
      phone: profile.phone ? profile.phone.replace(/\D/g, "").slice(0, 20) : null,
      area: profile.area ?? null,
      sexo: profile.sexo ?? null,
      onboarding_completed: profile.onboardingCompleted ?? null,
    }),
  });
}
/**
 * Salva os dados do currículo (extraídos de PDF) no user_metadata e na tabela profiles.
 * Assim a página de perfil e getUserProfile passam a ler do banco e não dependem de sessão atualizada.
 */
export async function saveCurriculumToMetadata(
  curriculumData: CurriculumData,
  userId?: string,
): Promise<void> {
  const payload: Record<string, unknown> = { curriculum_data: curriculumData };
  const lattesId = String(curriculumData.id || "").replace(/\D/g, "");
  if (/^\d{16}$/.test(lattesId)) payload.lattes_id = lattesId;

  try {
    await apiFetch("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return;
  } catch (backendError) {
    const uid =
      userId ||
      (await supabase.auth.getSession()).data.session?.user?.id ||
      null;
    if (!uid) throw backendError;

    const { error } = await supabase.from("profiles").upsert(
      { user_id: uid, ...payload },
      { onConflict: "user_id" },
    );
    if (error) throw error;
  }
}

export async function resolvePostLoginPath(user: SessionUser): Promise<string> {
  const redirect = sessionStorage.getItem("loginRedirect");
  if (redirect) {
    sessionStorage.removeItem("loginRedirect");
    return redirect;
  }
  const profile = await getUserProfile(user);
  if (profile?.onboardingCompleted === true) return "/dashboard";
  if (profile?.onboardingCompleted === false) return "/onboarding?new=1";
  // Perfil indisponível (rede/401): não mandar usuário existente de volta ao onboarding.
  return "/dashboard";
}

/**
 * Extrai o perfil do usuário atual (tabela profiles via API ou Supabase).
 */
function mergeSubscriptionFromAuthMetadata(
  profile: UserProfile,
  user?: { user_metadata?: Record<string, unknown> } | null,
): UserProfile {
  const sub = user?.user_metadata?.subscription;
  if (!sub || typeof sub !== "object") return profile;
  const s = sub as Record<string, unknown>;
  return {
    ...profile,
    stripeCustomerId: profile.stripeCustomerId ?? (s.stripe_customer_id as string | undefined),
    stripeSubscriptionId: profile.stripeSubscriptionId ?? (s.stripe_subscription_id as string | undefined),
    subscriptionStatus: profile.subscriptionStatus ?? (s.subscription_status as string | undefined),
    subscriptionPlanKey: profile.subscriptionPlanKey ?? (s.subscription_plan_key as string | undefined),
    subscriptionPriceId: profile.subscriptionPriceId ?? (s.subscription_price_id as string | undefined),
    subscriptionCurrentPeriodEnd:
      profile.subscriptionCurrentPeriodEnd ?? (s.subscription_current_period_end as string | undefined),
  };
}

export async function getUserProfile(user: SessionUser | null): Promise<UserProfile | null> {
  if (!user) return null;
  try {
    const out = await apiFetch<{ row: any; entitlements?: EntitlementsPayload }>("/api/profile", { method: "GET" });
    const profile = out.row;
    if (!profile) return getProfileFromSupabase(user.id);
    const mapped = mapProfileRow(profile, out.entitlements);
    const { data: authData } = await supabase.auth.getUser();
    const merged = mergeSubscriptionFromAuthMetadata(mapped, authData.user);
    return {
      ...merged,
      entitlements: out.entitlements ?? resolveEntitlementsFromProfile(merged),
    };
  } catch {
    const fromDb = await getProfileFromSupabase(user.id);
    if (!fromDb) return null;
    const { data: authData } = await supabase.auth.getUser();
    return mergeSubscriptionFromAuthMetadata(fromDb, authData.user);
  }
}

/**
 * Marca o onboarding como concluído no perfil (tabela profiles).
 * Usado ao concluir ou pular o onboarding para não exibir novamente.
 * Usa upsert para criar o perfil se ainda não existir.
 */
export async function setOnboardingCompleted(userId: string): Promise<void> {
  await patchProfileWithFallback(userId, { onboarding_completed: true });
}

/** Dados que podem ser atualizados a partir do onboarding. */
export interface OnboardingProfileUpdate {
  phone?: string;
  area?: string;
  userType?: "pesquisador" | "pessoa-empresa" | "ambos";
  cnpj?: string;
  hasCnpj?: boolean;
  sexo?: "masculino" | "feminino" | "outro" | "nao_informar";
  markOnboardingCompleted?: boolean;
}

/**
 * Atualiza o perfil com dados preenchidos no onboarding (telefone, área, tipo de usuário).
 * Opcionalmente marca o onboarding como concluído.
 * Usa upsert para criar o perfil se ainda não existir (ex.: quando o signup não criou a linha).
 */
export async function updateProfileFromOnboarding(
  userId: string,
  data: OnboardingProfileUpdate
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.phone !== undefined) patch.phone = data.phone.replace(/\D/g, "").slice(0, 20) || null;
  if (data.area !== undefined) patch.area = data.area || null;
  if (data.userType !== undefined) patch.user_type = data.userType;
  if (data.sexo !== undefined) patch.sexo = data.sexo || null;
  if (data.cnpj !== undefined) {
    const cnpjLimpo = data.cnpj.replace(/\D/g, "");
    patch.cnpj = cnpjLimpo.length === 14 ? cnpjLimpo : null;
    patch.has_cnpj = cnpjLimpo.length === 14;
  }
  if (data.hasCnpj !== undefined) patch.has_cnpj = data.hasCnpj;
  if (data.markOnboardingCompleted === true) patch.onboarding_completed = true;
  if (Object.keys(patch).length === 0) return;

  await patchProfileWithFallback(userId, patch);
}

/**
 * Função auxiliar para extrair perfil de user_metadata (fallback)
 */
function getProfileFromMetadata(user: User): UserProfile {
  const metadata = user.user_metadata;
  const profile = metadata?.profile || metadata;
  
  // Se não encontrou perfil, retornar perfil básico com tipo padrão
  if (!profile || (!profile.cpf && !profile.cnpj && !profile.lattesId)) {
    // Verificar se há algum dado nos metadados diretos
    if (metadata?.cpf || metadata?.cnpj || metadata?.lattesId) {
      return {
        cpf: metadata.cpf,
        cnpj: metadata.cnpj,
        lattesId: metadata.lattesId,
        userType: metadata.userType || "pesquisador",
        hasCnpj: metadata.hasCnpj,
        onboardingCompleted: Boolean(metadata?.profile?.onboarding_completed),
      };
    }
    // Retornar perfil vazio mas válido para permitir edição
    return {
      userType: "pesquisador",
      onboardingCompleted: Boolean(metadata?.profile?.onboarding_completed),
    };
  }

  return {
    cpf: profile.cpf,
    cnpj: profile.cnpj,
    lattesId: profile.lattesId,
    userType: profile.userType || "pesquisador",
    hasCnpj: profile.hasCnpj,
      sexo: profile.sexo,
    curriculumData: profile.curriculumData ?? undefined,
    onboardingCompleted: Boolean(profile.onboarding_completed),
    phone: profile.phone,
    area: profile.area,
  };
}

/**
 * Extrai CPF do perfil do usuário (apenas números) - versão síncrona
 * Busca do user_metadata (fallback rápido)
 */
export function extractCPF(user: User | null): string | null {
  if (!user) return null;
  const cpf = user.user_metadata?.profile?.cpf;
  return cpf ? cpf.replace(/\D/g, "") : null;
}

/**
 * Extrai CPF do perfil do usuário (apenas números) - versão assíncrona
 * Busca primeiro na tabela profiles, depois no user_metadata como fallback
 */
export async function extractCPFAsync(user: User | null): Promise<string | null> {
  if (!user) return null;
  
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('cpf')
      .eq('user_id', user.id)
      .single();
    
    if (profile?.cpf) return profile.cpf;
  } catch (error) {
    // Fallback para user_metadata
  }
  
  return extractCPF(user);
}

/**
 * Extrai CNPJ do perfil do usuário (apenas números) - versão síncrona
 * Busca do user_metadata (fallback rápido)
 */
export function extractCNPJ(user: User | null): string | null {
  if (!user) return null;
  const cnpj = user.user_metadata?.profile?.cnpj;
  return cnpj ? cnpj.replace(/\D/g, "") : null;
}

/**
 * Extrai CNPJ do perfil do usuário (apenas números) - versão assíncrona
 * Busca primeiro na tabela profiles, depois no user_metadata como fallback
 */
export async function extractCNPJAsync(user: User | null): Promise<string | null> {
  if (!user) return null;
  
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('cnpj')
      .eq('user_id', user.id)
      .single();
    
    if (profile?.cnpj) return profile.cnpj;
  } catch (error) {
    // Fallback para user_metadata
  }
  
  return extractCNPJ(user);
}

/**
 * Extrai ID Lattes do perfil do usuário - versão síncrona
 * Busca do user_metadata (fallback rápido)
 */
export function extractLattesId(user: User | null): string | null {
  if (!user) return null;
  return user.user_metadata?.profile?.lattesId || null;
}

/**
 * Extrai ID Lattes do perfil do usuário - versão assíncrona
 * Busca primeiro na tabela profiles, depois no user_metadata como fallback
 */
export async function extractLattesIdAsync(user: User | null): Promise<string | null> {
  if (!user) return null;
  
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('lattes_id')
      .eq('user_id', user.id)
      .single();
    
    if (profile?.lattes_id) return profile.lattes_id;
  } catch (error) {
    // Fallback para user_metadata
  }
  
  return extractLattesId(user);
}

/**
 * Verifica se o usuário tem CNPJ - versão síncrona
 * Busca do user_metadata (fallback rápido)
 */
export function hasCNPJ(user: User | null): boolean {
  if (!user) return false;
  const profile = user.user_metadata?.profile;
  return profile?.hasCnpj === true && !!profile?.cnpj;
}

/**
 * Verifica se o usuário tem CNPJ - versão assíncrona
 * Busca primeiro na tabela profiles, depois no user_metadata como fallback
 */
export async function hasCNPJAsync(user: User | null): Promise<boolean> {
  if (!user) return false;
  
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('has_cnpj, cnpj')
      .eq('user_id', user.id)
      .single();
    
    if (profile) {
      return profile.has_cnpj === true && !!profile.cnpj;
    }
  } catch (error) {
    // Fallback para user_metadata
  }
  
  return hasCNPJ(user);
}

/**
 * Retorna o tipo de usuário (pesquisador, pessoa-empresa ou ambos) - versão síncrona
 * Busca do user_metadata (fallback rápido)
 */
export function getUserType(user: User | null): "pesquisador" | "pessoa-empresa" | "ambos" | null {
  if (!user) return null;
  return user.user_metadata?.profile?.userType || null;
}

/**
 * Retorna o tipo de usuário (pesquisador, pessoa-empresa ou ambos) - versão assíncrona
 * Busca primeiro na tabela profiles, depois no user_metadata como fallback
 */
export async function getUserTypeAsync(user: User | null): Promise<"pesquisador" | "pessoa-empresa" | "ambos" | null> {
  if (!user) return null;
  
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('user_id', user.id)
      .single();
    
    if (profile?.user_type) {
      return profile.user_type as "pesquisador" | "pessoa-empresa" | "ambos";
    }
  } catch (error) {
    // Fallback para user_metadata
  }
  
  return getUserType(user);
}

/**
 * Valida formato de CPF (apenas formato, não dígito verificador)
 */
export function isValidCPFFormat(cpf: string): boolean {
  const numbers = cpf.replace(/\D/g, "");
  return numbers.length === 11;
}

/**
 * Valida formato de CNPJ (apenas formato, não dígito verificador)
 */
export function isValidCNPJFormat(cnpj: string): boolean {
  const numbers = cnpj.replace(/\D/g, "");
  return numbers.length === 14;
}

/**
 * Valida formato de ID Lattes (16 dígitos)
 */
export function isValidLattesId(lattesId: string): boolean {
  const numbers = lattesId.replace(/\D/g, "");
  return numbers.length === 16;
}

