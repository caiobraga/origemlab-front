import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import DemoModal from "@/components/DemoModal";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import ScrollReveal from "@/components/ScrollReveal";

export default function Hero() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const { user, loading } = useAuth();

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,color-mix(in_oklab,var(--institutional-paper)_78%,white)_100%)] pt-24 pb-20">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-0 top-0 h-full w-1 bg-primary" />
        <div className="absolute inset-x-0 top-0 h-px bg-[color:var(--institutional-line)]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-[color:var(--institutional-line)]" />
      </div>

      <div className="container relative z-10">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal className="mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 md:px-4 py-2 rounded-[2px] bg-white border border-[color:var(--institutional-line)] shadow-sm">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="institutional-kicker">
                Serviço digital para inteligência em fomento
              </span>
            </div>
          </ScrollReveal>

          {/* Main heading */}
          <ScrollReveal delay={0.05} className="max-w-4xl">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-gray-950 leading-[1.05] tracking-tight">
              Informações de fomento organizadas para decisão pública e institucional.
            </h1>
          </ScrollReveal>

          {/* Subheading */}
          <ScrollReveal delay={0.1} className="max-w-3xl">
            <p className="text-lg md:text-xl text-gray-700 mb-10 leading-relaxed">
              Monitore editais, consulte requisitos e apoie a elaboração de propostas com dados estruturados, rastreabilidade e governança.
            </p>
          </ScrollReveal>

          {/* CTA Buttons */}
          <ScrollReveal delay={0.15}>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {!loading && user ? (
                <Link href="/dashboard">
                  <Button size="lg" variant="attention" className="px-8 py-6 text-lg rounded-[2px]">
                    Acessar Meu Painel
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/cadastro">
                    <Button size="lg" variant="attention" className="px-8 py-6 text-lg rounded-[2px]">
                      Consultar oportunidades
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                  <Link href="/onboarding">
                    <Button
                      size="lg"
                      variant="outline"
                      className="px-8 py-6 text-lg border border-[color:var(--institutional-line)] hover:border-primary hover:bg-white rounded-[2px]"
                    >
                      Criar acesso
                    </Button>
                  </Link>
                  <Button
                    size="lg"
                    variant="ghost"
                    className="px-8 py-6 text-lg text-gray-700 hover:text-gray-950 hover:bg-white rounded-[2px]"
                    onClick={() => setIsDemoModalOpen(true)}
                  >
                    Ver demonstração
                  </Button>
                </>
              )}
            </div>
          </ScrollReveal>

          {/* Stats */}
          <ScrollReveal delay={0.2} className="mt-14">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl">
              <div>
                <div className="text-3xl md:text-4xl font-bold text-gray-950 mb-2">+2.000</div>
                <div className="text-sm text-gray-600">Instrumentos monitorados</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-gray-950 mb-2">R$ 20bi</div>
                <div className="text-sm text-gray-600">Potencial em projetos de inovação</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-gray-950 mb-2">20.000+</div>
                <div className="text-sm text-gray-600">Organizações atendidas pelo ecossistema</div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>

      <DemoModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
      />
    </section>
  );
}
