import { useMemo } from "react";
import { useUserProfile } from "./useUserProfile";
import {
  type EntitlementsPayload,
  hasProFeatures,
  canUsePropostas,
  canUseAiProposal,
  resolveEntitlementsFromProfile,
} from "@/lib/subscriptionEntitlements";

export function useSubscriptionEntitlements() {
  const { profile, loading } = useUserProfile();

  const entitlements = useMemo<EntitlementsPayload>(() => {
    if (profile?.entitlements) return profile.entitlements;
    return resolveEntitlementsFromProfile(profile);
  }, [profile]);

  return {
    loading,
    entitlements,
    proFeatures: hasProFeatures(entitlements),
    canUsePropostas: canUsePropostas(entitlements),
    canUseAiProposal: canUseAiProposal(entitlements),
    tier: entitlements.tier,
    planName: entitlements.plan_name,
  };
}
