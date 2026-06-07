import { Link } from "wouter";
import { Lock, Sparkles, Target, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FREE_CATALOG_PREVIEW } from "@/lib/subscriptionEntitlements";

type CatalogSubscriptionTeaserProps = {
  totalEditais: number;
  lockedCount: number;
  arrecadacaoMain: string;
  arrecadacaoDetail?: string;
  editaisComValor: number;
};

export default function CatalogSubscriptionTeaser({
  totalEditais,
  lockedCount,
  arrecadacaoMain,
  arrecadacaoDetail,
  editaisComValor,
}: CatalogSubscriptionTeaserProps) {
  const hidden = Math.max(lockedCount, totalEditais - FREE_CATALOG_PREVIEW);

  return (
    <section
      className="relative mt-6 overflow-hidden rounded-lg border border-primary/25 bg-gradient-to-br from-secondary/80 via-white to-primary/5 p-6 shadow-sm sm:p-8"
      aria-labelledby="catalog-upgrade-heading"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Plano gratuito
          </div>
          <div>
            <h2 id="catalog-upgrade-heading" className="text-xl font-bold text-gray-950 sm:text-2xl">
              {hidden > 0
                ? `Mais ${hidden} oportunidade${hidden === 1 ? "" : "s"} aguardando no catálogo Pro`
                : "Desbloqueie o catálogo completo com o plano Pro"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-700 sm:text-base">
              Você está vendo os {FREE_CATALOG_PREVIEW} primeiros editais. Assine para explorar todo o painel,
              filtros avançados, indicações por IA e propostas assistidas.
            </p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border/80 bg-white/90 px-4 py-3">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <Target className="h-4 w-4 text-primary" aria-hidden="true" />
                Editais no catálogo
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-950">{totalEditais}</dd>
            </div>
            <div className="rounded-md border border-border/80 bg-white/90 px-4 py-3">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <DollarSign className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                Potencial estimado
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-950" title={arrecadacaoDetail}>
                {arrecadacaoMain}
              </dd>
              {editaisComValor > 0 ? (
                <p className="mt-1 text-xs text-gray-600">
                  Com valores identificados em {editaisComValor} edital{editaisComValor === 1 ? "" : "is"}
                </p>
              ) : null}
            </div>
          </dl>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
          <Button asChild size="lg" className="gap-2">
            <Link href="/planos">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Assinar plano Pro
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/planos">Comparar planos</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
