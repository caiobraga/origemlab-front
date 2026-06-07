import { Link } from "wouter";
import { Calendar, DollarSign, Lock, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DatabaseEdital } from "@/lib/editaisApi";
import { formatValorProjeto } from "@/lib/editalFormatters";
import { getPrazoInscricaoDisplayPreferindoTimeline } from "@/lib/editalSubmissionDeadline";
import { FREE_CATALOG_PREVIEW } from "@/lib/subscriptionEntitlements";

export function buildLockedPreviewEditais(count: number): DatabaseEdital[] {
  const samples = [
    { orgao: "FAPESP", titulo: "Programa de apoio à pesquisa aplicada e inovação tecnológica" },
    { orgao: "CNPq", titulo: "Chamada pública para projetos de desenvolvimento científico e tecnológico" },
    { orgao: "FINEP", titulo: "Edital de fomento à inovação e transferência de tecnologia" },
    { orgao: "CAPES", titulo: "Programa de bolsas e projetos de pós-graduação e pesquisa" },
    { orgao: "FAPEMIG", titulo: "Apoio a projetos de pesquisa em áreas estratégicas" },
    { orgao: "BNDES", titulo: "Financiamento para projetos de impacto econômico e social" },
  ];
  return Array.from({ length: count }, (_, i) => {
    const s = samples[i % samples.length];
    return {
      id: `locked-preview-${i}`,
      numero: null,
      titulo: s.titulo,
      descricao: "Assine o Pro para ver detalhes completos deste edital.",
      data_publicacao: null,
      data_encerramento: null,
      status: null,
      valor: "R$ 500.000",
      area: "Tecnologia",
      orgao: s.orgao,
      fonte: "preview",
      link: null,
      processado_em: null,
      criado_em: new Date().toISOString(),
      atualizado_em: null,
      valor_projeto: null,
      prazo_inscricao: null,
    };
  });
}

type CatalogLockedEditalCardProps = {
  edital: DatabaseEdital;
};

/** Card bloqueado: blur só no conteúdo do card, cadeado por cima. */
export function CatalogLockedEditalCard({ edital }: CatalogLockedEditalCardProps) {
  const isPlaceholder = edital.id.startsWith("locked-preview-");
  const valorFormatado = formatValorProjeto(edital.valor_projeto || edital.valor);
  const prazoLabel = getPrazoInscricaoDisplayPreferindoTimeline(
    edital.prazo_inscricao,
    edital.timeline_estimada,
    { data_encerramento: edital.data_encerramento, criado_em: edital.criado_em },
  ).display;

  return (
    <div className="group relative flex min-h-[22rem] flex-col overflow-hidden rounded-md border border-border bg-white shadow-sm sm:min-h-[26rem]">
      <div className="flex min-h-[22rem] flex-col p-5 blur-[5px] sm:min-h-[26rem]" aria-hidden="true">
        <div className="mb-3">
          <Badge variant="outline" className="border-border bg-white text-primary">
            Público amplo
          </Badge>
        </div>
        <p className="mb-2 line-clamp-1 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
          {edital.orgao || "Órgão financiador"}
        </p>
        <h3 className="line-clamp-3 break-words text-lg font-bold leading-snug text-gray-900">{edital.titulo}</h3>
        {edital.descricao ? (
          <p className="mt-2 line-clamp-2 break-words text-sm text-gray-600">{edital.descricao}</p>
        ) : null}
        <div className="mt-auto space-y-2 border-t border-border pt-4 text-sm text-gray-700">
          <div className="flex items-start gap-2">
            <DollarSign className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <span className="line-clamp-2 font-semibold text-gray-900">{valorFormatado.display}</span>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <span className="line-clamp-2">Prazo: {prazoLabel}</span>
          </div>
          {edital.area ? (
            <div className="flex items-start gap-2">
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <span className="line-clamp-2">{edital.area}</span>
            </div>
          ) : null}
        </div>
      </div>

      <Link
        href={isPlaceholder ? "/planos" : `/edital/${edital.id}`}
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/55 px-4 text-center transition-colors hover:bg-white/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary shadow-sm">
          <Lock className="h-4 w-4 text-primary" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold text-gray-900">
          {isPlaceholder ? "Plano Pro" : "Ver edital"}
        </span>
        <span className="text-xs text-gray-600">
          {isPlaceholder ? "Toque para desbloquear o catálogo" : "Plano Pro: catálogo completo sem blur"}
        </span>
      </Link>
    </div>
  );
}

type CatalogUpgradeStripProps = {
  totalEditais: number;
  lockedCount: number;
  arrecadacaoMain: string;
  arrecadacaoDetail?: string;
  editaisComValor: number;
};

/** Faixa compacta abaixo da grade — sem overlay em bloco. */
export function CatalogUpgradeStrip({
  totalEditais,
  lockedCount,
  arrecadacaoMain,
  arrecadacaoDetail,
  editaisComValor,
}: CatalogUpgradeStripProps) {
  const hidden = Math.max(lockedCount, totalEditais - FREE_CATALOG_PREVIEW);

  return (
    <div className="mt-5 flex flex-col gap-4 rounded-md border border-primary/20 bg-secondary/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-900">
          +{hidden} editais e{" "}
          <span className="text-primary" title={arrecadacaoDetail}>
            {arrecadacaoMain}
          </span>{" "}
          em potencial de fomento
        </p>
        <p className="text-xs text-gray-600">
          Você vê {FREE_CATALOG_PREVIEW} editais em destaque por página de {totalEditais} no catálogo
          {editaisComValor > 0
            ? ` · estimativa de arrecadação em ${editaisComValor} edital${editaisComValor === 1 ? "" : "is"}`
            : ""}
          . Assine o Pro para desbloquear o catálogo completo sem blur.
        </p>
      </div>
      <Button asChild size="sm" className="shrink-0 gap-2 self-start sm:self-center">
        <Link href="/planos">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Assinar plano Pro
        </Link>
      </Button>
    </div>
  );
}
