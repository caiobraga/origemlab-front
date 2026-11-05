import { Button } from "@/components/ui/button";
import { Check, CircleAlert, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { usePublicCatalogStats } from "@/hooks/usePublicCatalogStats";

/** Illustrative record shown beside the headline: how an edital is summarised inside the product. */
function EditalSpecimen() {
  return (
    <figure className="mx-auto w-full max-w-md lg:mx-0 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <figcaption className="mb-4 text-sm text-gray-600">
        Exemplo de ficha. Os dados são ilustrativos.
      </figcaption>
      <div className="relative">
        {/* Second sheet behind the record, like a document on a pile */}
        <div
          className="absolute inset-0 translate-x-3 translate-y-3 rounded-md border border-line bg-paper"
          aria-hidden="true"
        />
        <div className="relative rounded-md border border-line bg-white shadow-[0_1px_0_var(--color-line)]">
          <div className="flex items-center justify-between border-b border-line px-5 py-3 text-sm">
            <span className="font-semibold text-ink">Agência de fomento</span>
            <span className="text-gray-600">Chamada pública</span>
          </div>

          <div className="px-5 pt-5 pb-4">
            <p className="font-display text-xl font-semibold leading-snug text-ink">
              Apoio a projetos de pesquisa em ciência, tecnologia e inovação
            </p>

            <dl className="mt-5 grid grid-cols-[6.5rem_1fr] gap-x-4 gap-y-2.5 text-sm">
              <dt className="text-gray-600">Prazo</dt>
              <dd className="font-semibold text-deadline">faltam 18 dias</dd>
              <dt className="text-gray-600">Valor</dt>
              <dd className="text-ink">até R$ 150 mil por projeto</dd>
              <dt className="text-gray-600">Quem pode</dt>
              <dd className="text-ink">Doutores com vínculo em instituição brasileira</dd>
              <dt className="text-gray-600">Área</dt>
              <dd className="text-ink">Todas as áreas do conhecimento</dd>
            </dl>
          </div>

          <div className="border-t border-line bg-paper/60 px-5 py-4">
            <p className="text-sm font-semibold text-ink">Por que foi indicado para você</p>
            <ul className="mt-2.5 space-y-2 text-sm">
              <li className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-verified" aria-hidden="true" />
                <span className="text-gray-700">Sua área de pesquisa é aceita no edital</span>
              </li>
              <li className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-verified" aria-hidden="true" />
                <span className="text-gray-700">Você tem a titulação exigida</span>
              </li>
              <li className="flex gap-2.5">
                <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-deadline" aria-hidden="true" />
                <span className="text-gray-700">
                  <span className="sr-only">Atenção: </span>
                  Este edital pede currículo em PDF. Envie o seu no perfil.
                </span>
              </li>
            </ul>
          </div>

          <div className="flex items-center gap-2 border-t border-line px-5 py-3 text-sm text-gray-600">
            <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
            Link para o edital oficial
          </div>
        </div>
      </div>
    </figure>
  );
}

export default function Hero() {
  const { user, loading } = useAuth();
  const { data: stats, isLoading } = usePublicCatalogStats();

  const catalogSummary =
    stats && stats.editaisCorretosCount > 0
      ? stats.fontesCount > 0
        ? `${stats.editaisCorretosCount.toLocaleString("pt-BR")} editais acompanhados em ${stats.fontesCount.toLocaleString("pt-BR")} fontes.`
        : `${stats.editaisCorretosCount.toLocaleString("pt-BR")} editais acompanhados.`
      : null;

  return (
    <section className="border-b border-line bg-white">
      <div className="container grid items-center gap-14 py-16 md:py-24 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:gap-16">
        <div>
          <h1 className="font-display text-[2.125rem] font-semibold leading-[1.08] tracking-[-0.015em] text-ink sm:text-5xl lg:text-[3.4rem]">
            Encontre os editais certos para sua pesquisa antes do prazo.
          </h1>

          <p className="mt-6 max-w-[36rem] text-lg leading-relaxed text-gray-700">
            Editais do CNPq, da FINEP, do BNDES e das fundações estaduais de amparo à pesquisa
            reunidos em um só lugar. Você recebe indicações para o seu perfil, acompanha os prazos e
            escreve a proposta com apoio de IA.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            {!loading && user ? (
              <Button asChild size="lg" variant="attention" className="h-12 px-7 text-base">
                <Link href="/dashboard">Abrir meu painel</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" variant="attention" className="h-12 px-7 text-base">
                  <Link href="/cadastro">Criar conta gratuita</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="ghost"
                  className="h-12 px-5 text-base text-primary hover:bg-secondary hover:text-primary"
                >
                  <a href="#como-funciona">Ver como funciona</a>
                </Button>
              </>
            )}
          </div>

          <p className="mt-10 min-h-[1.5rem] text-sm text-gray-600">
            {isLoading ? (
              <span className="inline-block h-4 w-64 max-w-full animate-pulse rounded-sm bg-muted align-middle" />
            ) : (
              catalogSummary
            )}
          </p>
        </div>

        <EditalSpecimen />
      </div>
    </section>
  );
}
