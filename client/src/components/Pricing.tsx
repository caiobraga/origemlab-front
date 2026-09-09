import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Sparkles, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { createCheckoutSession } from "@/lib/stripeBilling";
import { isOpenAccessMode } from "@/lib/subscriptionEntitlements";

type PlanAction =
  | { kind: "signup" }
  | { kind: "checkout"; planKey: "pro" | "empresas" }
  | { kind: "contact"; href: string }
  | { kind: "dashboard" };

const openAccess = isOpenAccessMode();

const plans: Array<{
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
  action: PlanAction;
}> = [
  {
    name: openAccess ? "Acesso aberto" : "Free",
    price: "R$ 0",
    period: "/mês",
    description: openAccess
      ? "Período de testes — todos os recursos liberados"
      : "Para iniciantes explorarem o ecossistema",
    features: openAccess
      ? [
          "Editais ilimitados",
          "IA redatora de propostas",
          "Chat e indicações",
          "Painel completo",
        ]
      : [
          "3 editais por mês",
          "Alertas básicos",
          "Painel simplificado",
          "Suporte por email",
        ],
    cta: openAccess ? "Começar agora" : "Começar Grátis",
    popular: openAccess,
    action: { kind: "signup" },
  },
  {
    name: "Pro",
    price: openAccess ? "Em breve" : "R$ 1,99",
    period: openAccess ? "" : "/mês",
    description: "Ideal para pesquisadores e startups",
    features: [
      "Editais ilimitados",
      "IA redatora de propostas",
      "Painel completo com métricas",
      "Alertas personalizados",
      "Suporte prioritário",
      "Histórico de submissões",
    ],
    cta: openAccess ? "Incluído nos testes" : "Assinar Pro",
    popular: !openAccess,
    action: openAccess ? { kind: "dashboard" } : { kind: "checkout", planKey: "pro" },
  },
  {
    name: "Empresas",
    price: openAccess ? "Em breve" : "R$ 199",
    period: openAccess ? "" : "/mês",
    description: "Para startups e corporações inovadoras",
    features: [
      "Inclui todos os recursos",
      "Multiusuário (até 10)",
      "Acompanhamento dedicado",
      "Relatórios executivos",
      "API de integração",
      "Consultoria estratégica",
    ],
    cta: openAccess ? "Em breve" : "Assinar Empresas",
    popular: false,
    action: openAccess ? { kind: "dashboard" } : { kind: "checkout", planKey: "empresas" },
  },
  {
    name: "Institucional",
    price: "Sob consulta",
    period: "",
    description: "Para órgãos, fundações e redes de apoio à inovação",
    features: [
      "Inclui todos os recursos",
      "Portal customizado",
      "Usuários ilimitados",
      "Infraestrutura dedicada",
      "SLA garantido",
      "Treinamento in-company",
    ],
    cta: "Solicitar Proposta",
    popular: false,
    action: { kind: "contact", href: "/contato" },
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [loadingPlan, setLoadingPlan] = useState<"pro" | "empresas" | null>(null);

  const handlePlanClick = async (action: PlanAction) => {
    if (action.kind === "signup") {
      setLocation(user ? "/dashboard" : "/cadastro");
      return;
    }
    if (action.kind === "dashboard") {
      setLocation(user ? "/dashboard" : "/cadastro");
      return;
    }
    if (action.kind === "contact") {
      setLocation(action.href);
      return;
    }
    if (openAccess) {
      toast.info("Cobrança pausada — acesso liberado para testes.");
      setLocation(user ? "/dashboard" : "/cadastro");
      return;
    }
    if (!user) {
      toast.info("Faça login ou crie uma conta para assinar.");
      setLocation(`/login?redirect=/planos`);
      return;
    }
    setLoadingPlan(action.planKey);
    try {
      const url = await createCheckoutSession(action.planKey);
      window.location.href = url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao abrir checkout.";
      toast.error(msg);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <section id="planos" className="py-24 bg-[color:var(--background)]">
      <div className="container">
        <div className="text-center mb-16">
          <p className="institutional-kicker mb-3">Planos de acesso</p>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
            {openAccess ? "Teste gratuito liberado" : "Planos para cada etapa"}
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {openAccess
              ? "Crie sua conta e use o sistema completo sem cobrança enquanto coletamos feedback."
              : "Escolha o plano ideal para transformar suas ideias em projetos financiados"}
          </p>
          {openAccess ? (
            <p className="mt-4 inline-block rounded-sm border border-primary/30 bg-secondary px-4 py-2 text-sm font-medium text-primary">
              Período de testes — Pro, propostas com IA e catálogo ilimitado sem assinatura
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {plans.map((plan, index) => (
            <Card
              key={index}
              className={`relative p-8 institutional-surface ${plan.popular ? "border-primary" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="flex items-center gap-1 px-4 py-1 rounded-sm bg-primary text-white text-sm font-medium shadow-sm">
                    <Sparkles className="w-4 h-4" />
                    {openAccess ? "Liberado agora" : "Mais Popular"}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-600">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.action.kind === "contact" ? (
                <Link href={plan.action.href}>
                  <Button
                    className={`w-full ${plan.popular ? "bg-primary hover:bg-primary/90 text-white" : "bg-white border border-border text-gray-900 hover:border-primary hover:bg-secondary"}`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              ) : (
                <Button
                  type="button"
                  disabled={
                    plan.action.kind === "checkout" &&
                    loadingPlan === plan.action.planKey
                  }
                  variant={plan.popular ? "attention" : "outline"}
                  className={`w-full ${plan.popular ? "" : "border border-border text-gray-900 hover:border-primary hover:bg-secondary"}`}
                  onClick={() => void handlePlanClick(plan.action)}
                >
                  {plan.action.kind === "checkout" && loadingPlan === plan.action.planKey ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Redirecionando…
                    </>
                  ) : (
                    plan.cta
                  )}
                </Button>
              )}
            </Card>
          ))}
        </div>

        {!openAccess ? (
          <div className="mt-12 text-center">
            <p className="text-gray-600">
              <span className="font-semibold text-gray-900">Success Fee:</span> 3% sobre projetos aprovados
              em todos os planos
            </p>
          </div>
        ) : null}

        <div className="mt-6 text-center">
          <Link
            href="/referencia"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium transition-colors"
          >
            <span>Compartilhe a plataforma com sua rede institucional</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
