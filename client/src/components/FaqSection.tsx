import type { ReactNode } from "react";
import ScrollReveal from "@/components/ScrollReveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { APP_TITLE } from "@/const";
import { Link } from "wouter";

const faqItems: { id: string; question: string; answer: ReactNode }[] = [
  {
    id: "faq-o-que-e",
    question: `O que é a ${APP_TITLE}?`,
    answer: (
      <p className="text-gray-600 leading-relaxed">
        A {APP_TITLE} é uma plataforma de inteligência para apoiar equipes na descoberta de
        oportunidades de fomento e na elaboração de propostas, combinando curadoria de
        informações com ferramentas de IA para acelerar o trabalho sem abrir mão da revisão
        humana.
      </p>
    ),
  },
  {
    id: "faq-para-quem",
    question: "Para quem a plataforma foi pensada?",
    answer: (
      <p className="text-gray-600 leading-relaxed">
        Para pesquisadores, empresas, startups e equipes de inovação que precisam acompanhar
        editais, organizar documentação e produzir textos de proposta com mais consistência e
        menos retrabalho.
      </p>
    ),
  },
  {
    id: "faq-editais",
    question: "Como encontro editais e linhas de apoio?",
    answer: (
      <p className="text-gray-600 leading-relaxed">
        Você explora oportunidades dentro da própria plataforma, com filtros e atualizações
        pensados para reduzir ruído. Recomendamos sempre conferir o edital oficial na fonte da
        agência ou programa antes de submeter qualquer material.
      </p>
    ),
  },
  {
    id: "faq-ia",
    question: "Como a IA ajuda na minha proposta?",
    answer: (
      <p className="text-gray-600 leading-relaxed">
        A IA pode sugerir estrutura, redação e checagens com base no que você informa sobre o
        projeto, agilizando rascunhos e revisões. O conteúdo final, a veracidade dos dados e a
        adequação ao edital continuam sendo de sua responsabilidade — use a IA como copiloto,
        não como substituto da sua equipe.
      </p>
    ),
  },
  {
    id: "faq-planos",
    question: "O que entra em cada plano?",
    answer: (
      <p className="text-gray-600 leading-relaxed">
        Os limites e recursos variam por plano (créditos de IA, número de propostas, painéis,
        etc.). Confira a comparação completa na{" "}
        <a href="#planos" className="font-medium text-blue-600 underline-offset-2 hover:underline">
          seção Planos
        </a>{" "}
        desta página ou na página dedicada a planos.
      </p>
    ),
  },
  {
    id: "faq-dados",
    question: "Meus dados e documentos ficam seguros?",
    answer: (
      <p className="text-gray-600 leading-relaxed">
        Tratamos suas informações com cuidado e boas práticas de produto. Detalhes sobre
        coleta, uso e direitos estão na{" "}
        <Link href="/politica-privacidade" className="font-medium text-blue-600 underline-offset-2 hover:underline">
          Política de Privacidade
        </Link>
        .
      </p>
    ),
  },
  {
    id: "faq-consultor",
    question: "A plataforma substitui consultoria ou a decisão da agência de fomento?",
    answer: (
      <p className="text-gray-600 leading-relaxed">
        Não. A {APP_TITLE} complementa seu processo com informação e produtividade; não
        substitui assessoria jurídica, contábil ou técnica especializada, nem garante aprovação
        ou resultados junto a órgãos financiadores.
      </p>
    ),
  },
];

export default function FaqSection() {
  return (
    <section
      id="faq"
      className="py-24 bg-white border-t border-gray-100"
      aria-labelledby="faq-heading"
    >
      <div className="container max-w-3xl">
        <ScrollReveal className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 mb-2">
            Para saber mais
          </p>
          <h2
            id="faq-heading"
            className="text-4xl md:text-5xl font-bold mb-4 text-gray-900"
          >
            Perguntas frequentes
          </h2>
          <p className="text-xl text-gray-600">
            Respostas diretas sobre a plataforma, planos e uso da IA
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.08}>
          <Accordion type="single" collapsible className="w-full border border-gray-200 rounded-xl px-4 md:px-6 bg-gray-50/50">
            {faqItems.map((item) => (
              <AccordionItem key={item.id} value={item.id} className="border-gray-200">
                <AccordionTrigger className="text-left text-base font-semibold text-gray-900 hover:no-underline py-5">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-base">{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollReveal>

        <ScrollReveal delay={0.12} className="text-center mt-10">
          <p className="text-gray-600">
            Não achou o que precisa?{" "}
            <Link href="/contato" className="font-medium text-blue-600 underline-offset-2 hover:underline">
              Fale conosco
            </Link>
            .
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
