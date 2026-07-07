/** Espelho do backend — planos e recursos (Pricing / Planos). */

export const FREE_EDITAIS_PER_MONTH = 3;
/** Quantos editais o plano gratuito vê em destaque no dashboard (upsell abaixo). */
export const FREE_CATALOG_PREVIEW = FREE_EDITAIS_PER_MONTH;

export type PlanTier = "free" | "pro" | "empresas" | "institucional";

export type EntitlementsPayload = {
  tier: PlanTier;
  plan_name: string;
  pro_features: boolean;
  limits: {
    editais_per_month: number | null;
  };
  features: {
    editais_catalog: boolean;
    edital_chat: boolean;
    ai_proposal: boolean;
    propostas: boolean;
    indicacoes: boolean;
    dashboard_metrics: boolean;
  };
  usage?: {
    editais_views: { used: number; limit: number; accessed_ids: string[] };
  };
};

export function canAccessEditalCatalog(
  _entitlements?: EntitlementsPayload | null,
  _editalId?: string,
  _previewEditalIds?: ReadonlySet<string> | string[],
): boolean {
  return true;
}

/** Plano gratuito no dashboard: exibe só os N primeiros da lista filtrada. */
export function sliceCatalogForFreePreview<T>(rows: T[], entitlements?: EntitlementsPayload | null): T[] {
  if (hasProFeatures(entitlements)) return rows;
  return rows.slice(0, FREE_CATALOG_PREVIEW);
}

export function editalCatalogUsageLabel(entitlements?: EntitlementsPayload | null): string | null {
  if (hasProFeatures(entitlements)) return null;
  const usage = entitlements?.usage?.editais_views;
  if (!usage) return null;
  return `${usage.used}/${usage.limit} editais este mês`;
}

export function hasProFeatures(entitlements?: EntitlementsPayload | null): boolean {
  return Boolean(entitlements?.pro_features);
}

export function canUsePropostas(entitlements?: EntitlementsPayload | null): boolean {
  return Boolean(entitlements?.features?.propostas);
}

export function canUseAiProposal(entitlements?: EntitlementsPayload | null): boolean {
  return Boolean(entitlements?.features?.ai_proposal);
}

export function resolveEntitlementsFromProfile(profile: {
  isAdmin?: boolean;
  subscriptionStatus?: string;
  subscriptionPlanKey?: string;
} | null): EntitlementsPayload {
  const status = profile?.subscriptionStatus || "";
  const activeLike = status === "active" || status === "trialing" || status === "past_due";
  const key = profile?.subscriptionPlanKey || "";
  const pro = activeLike && (key === "pro" || key === "empresas" || key === "institucional");
  const tier: PlanTier = pro
    ? key === "empresas"
      ? "empresas"
      : key === "institucional"
        ? "institucional"
        : "pro"
    : "free";

  return {
    tier,
    plan_name: tier === "free" ? "Gratuito" : tier === "pro" ? "Pro" : tier === "empresas" ? "Empresas" : "Institucional",
    pro_features: pro,
    limits: { editais_per_month: pro ? null : FREE_EDITAIS_PER_MONTH },
    features: {
      editais_catalog: true,
      edital_chat: pro,
      ai_proposal: pro,
      propostas: pro,
      indicacoes: pro,
      dashboard_metrics: pro,
    },
    usage: pro
      ? undefined
      : {
          editais_views: {
            used: 0,
            limit: FREE_EDITAIS_PER_MONTH,
            accessed_ids: [],
          },
        },
  };
}

export function subscriptionUpgradeMessage(feature?: string): string {
  if (feature === "editais_catalog") {
    return "Explore o catálogo no plano gratuito. Assine o Pro para ver todos os editais sem blur e recursos avançados.";
  }
  if (feature === "propostas" || feature === "ai_proposal") {
    return "Gerar e editar propostas com IA está disponível no plano Pro. Assine para desbloquear.";
  }
  return "Recurso disponível no plano Pro. Assine em /planos para desbloquear.";
}

export function isSubscriptionError(error: unknown): error is Error & { message: string } {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("subscription_required") ||
    error.message.includes("subscription_limit") ||
    error.message.includes("plano Pro") ||
    error.message.includes("Assine em /planos") ||
    error.message.includes("Assine o Pro")
  );
}
