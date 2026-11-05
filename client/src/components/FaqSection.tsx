import type { ReactNode } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { APP_TITLE } from "@/const";
import { isOpenAccessMode } from "@/lib/subscriptionEntitlements";
import { Link } from "wouter";

const faqItems: { id: string; question: string; answer: ReactNode }[] = [
  {
    id: "faq-o-que-e",
    question: `O que é a ${APP_TITLE}?`,
    answer: (
      <p className="text-gray-600 leading-relaxed">
        A {APP_TITLE} reúne editais de agências federais e fundações estaduais, indica quais
        combinam com o seu perfil e ajuda a escrever a proposta. A leitura dos editais e as
        indicações são automáticas, feitas com IA. O texto oficial do edital continua sendo a
        referência.
      </p>
    ),
  },
  {
    id: "faq-para-quem",
    question: "Para quem a plataforma foi pensada?",
    answer: (
      <p className="text-gray-600 leading-relaxed">
        Pesquisadores, grupos de pesquisa, núcleos de inovação de universidades e empresas que
        buscam fomento para pesquisa e inovação.
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
        A IA sugere estrutura e texto a partir do edital e do que você informa sobre o projeto.
        Ela pode errar: confira dados, valores e exigências antes de enviar. A proposta enviada à
        agência é de responsabilidade de quem submete.
      </p>
    ),
  },
  {
    id: "faq-planos",
    question: "O que entra em cada plano?",
    answer: (
      <p className="text-gray-600 leading-relaxed">
        {isOpenAccessMode()
          ? "Durante o período de testes, todos os recursos estão liberados e sem cobrança."
          : "Cada plano tem limites próprios de editais, propostas e usuários."}{" "}
        Veja os detalhes na{" "}
        <a href="#planos" className="font-medium text-primary underline-offset-2 hover:underline">
          seção Planos
        </a>
        .
      </p>
    ),
  },
  {
    id: "faq-dados",
    question: "Meus dados e documentos ficam seguros?",
    answer: (
      <p className="text-gray-600 leading-relaxed">
        Seus dados de perfil e documentos são usados para gerar indicações e propostas. Os
        detalhes sobre coleta, uso e seus direitos estão na{" "}
        <Link href="/politica-privacidade" className="font-medium text-primary underline-offset-2 hover:underline">
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
      className="scroll-mt-20 border-t border-line bg-paper py-20 md:py-24"
      aria-labelledby="faq-heading"
    >
      <div className="container grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
        <div>
          <h2
            id="faq-heading"
            className="section-title"
          >
            Dúvidas frequentes
          </h2>
          <p className="mt-4 text-lg text-gray-700">
            Não achou o que precisa?{" "}
            <Link href="/contato" className="font-medium text-primary underline-offset-4 hover:underline">
              Fale com a gente
            </Link>
            .
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full border-t border-line">
          {faqItems.map((item) => (
            <AccordionItem key={item.id} value={item.id} className="border-line">
              <AccordionTrigger className="py-5 text-left text-base font-semibold text-ink hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-base">{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
