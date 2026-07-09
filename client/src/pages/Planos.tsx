import { useEffect, useState } from "react";
import { Link } from "wouter";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Pricing from "@/components/Pricing";
import FaqSection from "@/components/FaqSection";
import Footer from "@/components/Footer";
import AIHumanSection from "@/components/AIHumanSection";
import IntelligentPanel from "@/components/IntelligentPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { createBillingPortalSession, createCheckoutSession } from "@/lib/stripeBilling";
import { Check, CreditCard, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type PaidPlanKey = "pro" | "empresas";

const accountPlans: Array<{
  key: "free" | PaidPlanKey | "institucional";
  name: string;
  price: string;
  description: string;
  features: string[];
  recommended?: boolean;
}> = [
  {
    key: "free",
    name: "Gratuito",
    price: "R$ 0/mês",
    description: "Acesso inicial para consultar oportunidades e conhecer o fluxo.",
    features: ["3 editais por mês", "Perfil básico", "Alertas essenciais"],
  },
  {
    key: "pro",
    name: "Pro",
    price: "R$ 1,99/mês",
    description: "Para quem acompanha editais com frequência e prepara propostas.",
    features: ["Editais ilimitados", "Geração de propostas com IA", "Indicações personalizadas", "Histórico de submissões"],
    recommended: true,
  },
  {
    key: "empresas",
    name: "Empresas",
    price: "R$ 199/mês",
    description: "Para equipes que precisam organizar oportunidades e propostas.",
    features: ["Recursos do Pro", "Operação multiusuário", "Relatórios executivos", "Acompanhamento prioritário"],
  },
  {
    key: "institucional",
    name: "Institucional",
    price: "Sob consulta",
    description: "Para fundações, órgãos públicos e redes de inovação.",
    features: ["Portal customizado", "Usuários ilimitados", "Treinamento e implantação", "SLA dedicado"],
  },
];

function statusLabel(status?: string) {
  if (status === "active") return "Assinatura ativa";
  if (status === "trialing") return "Período de teste";
  if (status === "past_due") return "Pagamento em atraso";
  if (status === "canceled") return "Assinatura cancelada";
  return "Plano gratuito";
}

function planLabel(planKey?: string) {
  if (planKey === "empresas") return "Empresas";
  if (planKey === "pro") return "Pro";
  return "Gratuito";
}

function LoggedInPlans() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<PaidPlanKey | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const subscriptionStatus = profile?.subscriptionStatus;
  const activeLike = subscriptionStatus === "active" || subscriptionStatus === "trialing" || subscriptionStatus === "past_due";
  const currentPlanKey = activeLike && profile?.subscriptionPlanKey ? profile.subscriptionPlanKey : "free";

  const handleCheckout = async (planKey: PaidPlanKey) => {
    if (!user) {
      toast.info("Faça login para assinar.");
      return;
    }
    setCheckoutLoadingPlan(planKey);
    try {
      const url = await createCheckoutSession(planKey);
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao abrir checkout.");
    } finally {
      setCheckoutLoadingPlan(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const url = await createBillingPortalSession();
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao abrir portal de cobrança.");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <Header />
      <main id="main-content" className="container py-8 md:py-10">
        <div className="mb-8 flex flex-col gap-4 border-b border-[color:var(--institutional-line)] pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="institutional-kicker mb-2">Gestão de assinatura</p>
            <h1 className="text-2xl font-bold tracking-tight text-gray-950 md:text-3xl">Planos e cobrança</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-700 md:text-base">
              Consulte seu plano atual, faça upgrade ou acesse a área segura de cobrança.
            </p>
          </div>
          <Link href="/dashboard">
            <Button variant="outline" className="w-full border-border bg-white md:w-auto">
              Voltar ao painel
            </Button>
          </Link>
        </div>

        <Card className="mb-8 overflow-hidden border-[color:var(--institutional-line)] bg-white py-0 shadow-sm">
          <div className="grid gap-0 md:grid-cols-[1.2fr_0.8fr]">
            <div className="border-b border-[color:var(--institutional-line)] p-6 md:border-b-0 md:border-r">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="rounded-sm border-border bg-secondary text-primary">
                  {profileLoading ? "Carregando" : statusLabel(subscriptionStatus)}
                </Badge>
                {profile?.subscriptionCurrentPeriodEnd ? (
                  <span className="text-xs text-gray-500">
                    Renovação: {new Date(profile.subscriptionCurrentPeriodEnd).toLocaleDateString("pt-BR")}
                  </span>
                ) : null}
              </div>
              <h2 className="text-xl font-semibold text-gray-950">Plano atual: {profileLoading ? "..." : planLabel(currentPlanKey)}</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Sua assinatura é gerenciada pelo Stripe. Alterações de cartão, notas e cancelamento ficam disponíveis no portal seguro de cobrança.
              </p>
            </div>
            <div className="flex flex-col justify-center gap-3 bg-secondary/40 p-6">
              <Button
                type="button"
                className="w-full bg-primary hover:bg-primary/90"
                onClick={handlePortal}
                disabled={portalLoading || !profile?.stripeCustomerId}
              >
                {portalLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                Gerenciar cobrança
              </Button>
              {!profile?.stripeCustomerId ? (
                <p className="text-xs leading-relaxed text-gray-600">
                  O portal de cobrança aparece após a primeira assinatura paga.
                </p>
              ) : null}
            </div>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-4">
          {accountPlans.map((plan) => {
            const isCurrent = currentPlanKey === plan.key;
            const isCheckoutPlan = plan.key === "pro" || plan.key === "empresas";
            const loadingPlan = isCheckoutPlan && checkoutLoadingPlan === plan.key;

            return (
              <Card
                key={plan.key}
                className={`relative border-[color:var(--institutional-line)] bg-white shadow-sm ${
                  plan.recommended ? "border-primary" : ""
                }`}
              >
                {plan.recommended ? (
                  <div className="absolute right-4 top-4">
                    <Badge className="rounded-sm bg-primary text-white">Mais usado</Badge>
                  </div>
                ) : null}
                <CardHeader className="pr-24">
                  <CardTitle className="text-xl text-gray-950">{plan.name}</CardTitle>
                  <p className="text-sm text-gray-600">{plan.description}</p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <div className="mb-5 text-2xl font-semibold tracking-tight text-gray-950">{plan.price}</div>
                  <ul className="mb-6 space-y-3 text-sm text-gray-700">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto">
                    {isCurrent ? (
                      <Button type="button" variant="outline" className="w-full border-border bg-secondary text-primary" disabled>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Plano atual
                      </Button>
                    ) : isCheckoutPlan ? (
                      <Button
                        type="button"
                        variant={plan.recommended ? "attention" : "outline"}
                        className={`w-full ${plan.recommended ? "" : "border-border bg-white hover:bg-secondary"}`}
                        disabled={checkoutLoadingPlan !== null}
                        onClick={() => void handleCheckout(plan.key as PaidPlanKey)}
                      >
                        {loadingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {loadingPlan ? "Redirecionando..." : `Assinar ${plan.name}`}
                      </Button>
                    ) : plan.key === "institucional" ? (
                      <Link href="/contato">
                        <Button type="button" variant="outline" className="w-full border-border bg-white hover:bg-secondary">
                          Falar com equipe
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    ) : (
                      <Button type="button" variant="outline" className="w-full border-border bg-white" disabled>
                        Incluído na conta
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 rounded-sm border border-[color:var(--institutional-line)] bg-white p-5 text-sm text-gray-700">
          <p className="font-semibold text-gray-950">Observação sobre sucesso do projeto</p>
          <p className="mt-1">
            Planos pagos podem incluir success fee de 3% sobre projetos aprovados, conforme condições comerciais vigentes.
          </p>
        </div>
      </main>
    </div>
  );
}

/** Landing com scroll até a seção de planos (útil para usuários logados vindo do dashboard). */
export default function Planos() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user || loading) return;
    const id = window.location.hash.replace(/^#/, "") || "planos";
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [loading, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[color:var(--background)]">
        <Header />
        <main id="main-content" className="container flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (user) return <LoggedInPlans />;

  return (
    <div className="flex-1">
      <Header />
      <main id="main-content">
        <Hero />
        <HowItWorks />
        <AIHumanSection />
        <IntelligentPanel />
        <Pricing />
        <FaqSection />
      </main>
      <Footer />
    </div>
  );
}
