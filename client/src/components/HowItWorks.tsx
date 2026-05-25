import { Card } from "@/components/ui/card";
import { User, Search, Target, Send } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";

const steps = [
  {
    icon: User,
    title: "Crie seu perfil",
    description: "Cadastre informações sobre sua empresa, área de atuação e objetivos de inovação.",
  },
  {
    icon: Search,
    title: "IA faz a busca",
    description: "Nossa inteligência artificial vasculha automaticamente milhares de editais compatíveis.",
  },
  {
    icon: Target,
    title: "Veja oportunidades",
    description: "Painel personalizado mostra editais ranqueados por aderência e probabilidade de aprovação.",
  },
  {
    icon: Send,
    title: "Submeta com IA",
    description: "Assistente inteligente gera propostas, envia e acompanha todo o processo até a prestação de contas.",
  }
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="py-24 institutional-section">
      <div className="container">
        <ScrollReveal className="mb-16">
          <div className="max-w-3xl">
            <p className="institutional-kicker mb-3">Processo de trabalho</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">Como funciona</h2>
            <p className="text-lg md:text-xl text-gray-600">
              Do mapeamento à prestação de contas, tudo em um só lugar.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <ScrollReveal key={index} delay={0.05 * index}>
              <Card className="relative p-8 institutional-surface group">
              {/* Step number */}
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-sm bg-primary flex items-center justify-center text-white font-bold text-lg shadow-sm">
                {index + 1}
              </div>

              {/* Icon */}
              <div className="w-16 h-16 rounded-sm bg-secondary border border-border flex items-center justify-center mb-6">
                <step.icon className="w-8 h-8 text-primary" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-bold mb-3 text-gray-900">
                {step.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {step.description}
              </p>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
