import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Loader2 } from "lucide-react";
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
    name: openAccess ? "Acesso aberto" : "Gratuito",
    price: "R$ 0",
    period: "/mês",
    description: openAccess
      ? "Período de testes, com todos os recursos liberados"
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
          "Suporte por e-mail",
        ],
    cta: openAccess ? "Começar agora" : "Começar grátis",
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
    cta: "Solicitar proposta",
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
    <section id="planos" className="scroll-mt-20 border-t border-line bg-white py-20 md:py-24">
      <div className="container">
        <div className="mb-14 max-w-2xl">
          <h2 className="section-title">
            {openAccess ? "Uso gratuito durante os testes" : "Planos"}
          </h2>
          <p className="mt-4 text-lg text-gray-700">
            {openAccess
              ? "Durante o período de testes, todas as funções estão liberadas e sem cobrança."
              : "Comece pelo plano gratuito e mude quando precisar de mais editais, alertas ou usuários."}
          </p>
        </div>

        {openAccess ? (
          <>
            <div className="grid gap-10 border-y border-line py-10 lg:grid-cols-2">
              <div>
                <p className="font-display text-4xl font-semibold text-ink">R$ 0</p>
                <p className="mt-2 text-gray-700">durante o período de testes</p>
                <Button asChild variant="attention" size="lg" className="mt-6 h-12 px-7 text-base">
                  <Link href={user ? "/dashboard" : "/cadastro"}>
                    {user ? "Abrir meu painel" : "Criar conta gratuita"}
                  </Link>
                </Button>
              </div>
              <ul className="space-y-3 text-gray-700">
                {[
                  "Catálogo completo de editais",
                  "Indicações para o seu perfil, com os motivos",
                  "Editor de propostas com sugestões de IA",
                  "Projetos organizados por edital",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="mt-1 h-4 w-4 flex-shrink-0 text-verified" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-6 text-gray-600">
              Planos para equipes e instituições ainda estão em definição.{" "}
              <Link href="/contato" className="font-medium text-primary underline-offset-4 hover:underline">
                Fale com a gente
              </Link>
              .
            </p>
          </>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, index) => (
            <Card
              key={index}
              className={`relative gap-0 rounded-md border bg-white p-7 shadow-none ${plan.popular ? "border-t-4 border-primary" : "border-line"}`}
            >
              <div className="mb-6">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className="text-xl font-semibold text-ink">{plan.name}</h3>
                  {plan.popular ? (
                    <span className="text-sm font-medium text-primary">
                      {openAccess ? "Liberado agora" : "Mais escolhido"}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-3xl font-semibold text-ink">{plan.price}</span>
                  <span className="text-gray-600">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-verified flex-shrink-0 mt-1" aria-hidden="true" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.action.kind === "contact" ? (
                <Button
                  asChild
                  className={`w-full ${plan.popular ? "bg-primary hover:bg-primary/90 text-white" : "bg-white border border-border text-gray-900 hover:border-primary hover:bg-secondary"}`}
                >
                  <Link href={plan.action.href}>{plan.cta}</Link>
                </Button>
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

        )}

        {!openAccess ? (
          <div className="mt-10">
            <p className="text-gray-600">
              <span className="font-semibold text-gray-900">Taxa de êxito:</span> 3% sobre projetos aprovados,
              em todos os planos
            </p>
          </div>
        ) : null}

        <div className="mt-6">
          <Link
            href="/referencia"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Indique a plataforma para colegas e para a sua instituição
          </Link>
        </div>
      </div>
    </section>
  );
}
