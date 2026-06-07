/** Espelho do backend — planos e recursos (Pricing / Planos). */

export const FREE_EDITAIS_PER_MONTH = 3;

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
  entitlements?: EntitlementsPayload | null,
  editalId?: string,
): boolean {
  if (hasProFeatures(entitlements)) return true;
  const usage = entitlements?.usage?.editais_views;
  if (!usage) return false;
  const id = String(editalId || "").trim();
  if (id && usage.accessed_ids.includes(id)) return true;
  return usage.used < usage.limit;
}

/** Plano gratuito: exibe no máximo N editais (prioriza os já abertos no mês). */
export function limitEditaisForFreeTier<T extends { id: string }>(
  rows: T[],
  entitlements?: EntitlementsPayload | null,
): T[] {
  if (hasProFeatures(entitlements)) return rows;
  const accessedIds = entitlements?.usage?.editais_views?.accessed_ids ?? [];
  return applyFreeCatalogListLimit(rows, accessedIds);
}

function applyFreeCatalogListLimit<T extends { id: string }>(
  rows: T[],
  accessedIds: string[],
  maxVisible = FREE_EDITAIS_PER_MONTH,
): T[] {
  if (maxVisible <= 0) return [];
  const accessedSet = new Set(accessedIds.map(String));
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  const accessedRows = accessedIds
    .map((id) => byId.get(String(id)))
    .filter((row): row is T => Boolean(row));
  const rest = rows.filter((r) => !accessedSet.has(String(r.id)));
  const merged: T[] = [];
  const seen = new Set<string>();
  for (const row of [...accessedRows, ...rest]) {
    const id = String(row.id);
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(row);
    if (merged.length >= maxVisible) break;
  }
  return merged;
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

export function resolveEntitlementsFromProfile(profile: {
  isAdmin?: boolean;
  subscriptionStatus?: string;
  subscriptionPlanKey?: string;
} | null): EntitlementsPayload {
  if (profile?.isAdmin) {
    return {
      tier: "institucional",
      plan_name: "Institucional",
      pro_features: true,
      limits: { editais_per_month: null },
      features: {
        editais_catalog: true,
        edital_chat: true,
        ai_proposal: true,
        propostas: true,
        indicacoes: true,
        dashboard_metrics: true,
      },
    };
  }

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
    return `Plano gratuito: até ${FREE_EDITAIS_PER_MONTH} editais por mês. Assine o Pro para acesso ilimitado.`;
  }
  return "Recurso disponível no plano Pro. Assine em /planos para desbloquear.";
}

export function isSubscriptionError(error: unknown): error is Error & { message: string } {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("subscription_required") ||
    error.message.includes("subscription_limit") ||
    error.message.includes("plano Pro")
  );
}
