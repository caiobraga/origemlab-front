import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { 
  Search, Filter, Calendar, DollarSign, Target, AlertCircle,
  Sparkles, Loader2, Share2, ChevronLeft, ChevronRight, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { UserProfile } from "@/lib/userProfile";
import Header from "@/components/Header";
import {
  DatabaseEdital,
  formatPrazo,
  getPaisFromEdital,
  getStatusFromEdital,
  editalMatchesArea,
  AREA_FILTER_OPTIONS,
} from "@/lib/editaisApi";
import { useEditaisList } from "@/hooks/useEditaisDashboard";
import { useDashboardFilters } from "@/hooks/useDashboardFilters";
import { useEditaisIndicacoes } from "@/hooks/useEditaisIndicacoes";
import { formatValorProjeto } from "@/lib/editalFormatters";
import { computeArrecadacaoCatalogo, formatArrecadacaoResumo } from "@/lib/editalValorStats";
import {
  getPrazoInscricaoDisplayPreferindoTimeline,
  isEditalAtivoByDeadlines,
} from "@/lib/editalSubmissionDeadline";
import { gerarPropostaComIA } from "@/lib/propostasApi";
import { useSubscriptionEntitlements } from "@/hooks/useSubscriptionEntitlements";
import UpgradePlanBanner from "@/components/UpgradePlanBanner";
import { FREE_EDITAIS_PER_MONTH, canAccessEditalCatalog, editalCatalogUsageLabel, limitEditaisForFreeTier, subscriptionUpgradeMessage } from "@/lib/subscriptionEntitlements";

interface EditalDisplay extends DatabaseEdital {
  prazo: string;
  pais: string;
  flag: string;
  status: "novo" | "em_analise" | "submetido";
  elegivel: boolean;
}

const PAGE_SIZE = 9;

function getDashboardPageNumbers(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const range: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      range.push(i);
    }
  }
  const withEllipsis: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const page of range) {
    if (prev && page - prev > 1) withEllipsis.push("ellipsis");
    withEllipsis.push(page);
    prev = page;
  }
  return withEllipsis;
}

export default function Dashboard() {
  const {
    filtroArea,
    setFiltroArea,
    busca,
    setBusca,
    mostrarInativos,
    setMostrarInativos,
    ignorarFiltroPerfil,
    setIgnorarFiltroPerfil,
    filtroTipoEdital,
    setFiltroTipoEdital,
    apenasIndicacoes,
    setApenasIndicacoes,
    ordenacao,
    setOrdenacao,
    currentPage,
    setCurrentPage,
    clearFilters,
  } = useDashboardFilters();
  const [gerandoProposta, setGerandoProposta] = useState<string | null>(null);
  const [filtrosSheetOpen, setFiltrosSheetOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const { proFeatures: proFeaturesFromProfile, entitlements: profileEntitlements } = useSubscriptionEntitlements();
  const indicacoesQuery = useEditaisIndicacoes(user?.id, {
    limit: 12,
    autoRefresh: proFeaturesFromProfile,
    enabled: proFeaturesFromProfile,
  });
  const indicacoesMap = (() => {
    const m = new Map<string, { score: number; motivos: string[] }>();
    for (const item of indicacoesQuery.data ?? []) {
      if (item?.edital?.id) {
        m.set(item.edital.id, {
          score: Number(item.score) || 0,
          motivos: Array.isArray(item.motivos) ? item.motivos.filter(Boolean).map(String) : [],
        });
      }
    }
    return m;
  })();

  // 1. Lista em cache (5 min) - carregamento rápido
  const editaisListQuery = useEditaisList(user?.id);
  const editaisRaw = editaisListQuery.data?.rows ?? [];
  const entitlements = editaisListQuery.data?.entitlements ?? profileEntitlements;
  const proFeatures = entitlements.pro_features;
  const catalogUsageLabel = editalCatalogUsageLabel(entitlements);
  const catalogLockedCount = editaisListQuery.data?.catalog_locked_count ?? 0;
  const editaisIndicadosRaw = (indicacoesQuery.data ?? [])
    .map((i) => i.edital)
    .filter(Boolean);
  // Importante:
  // - Quando "Apenas indicações" estiver ligado, a fonte da lista deve ser as próprias indicações.
  // - Quando estiver em "Todos", ainda assim precisamos garantir que as indicações apareçam no feed
  //   (mesmo que não estejam entre os ~120 mais recentes), então fazemos merge + dedupe por id.
  const editaisRawMerged = (() => {
    const out: any[] = [];
    const seen = new Set<string>();

    // 1) indicados primeiro (ordem do array já vem por score)
    for (const e of editaisIndicadosRaw as any[]) {
      const id = e?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(e);
    }

    // 2) depois o feed padrão (recentes)
    for (const e of editaisRaw as any[]) {
      const id = e?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(e);
    }

    return out;
  })();

  const editaisRawForList = (() => {
    const base = apenasIndicacoes ? editaisIndicadosRaw : editaisRawMerged;
    return limitEditaisForFreeTier(base as DatabaseEdital[], entitlements);
  })();

  // Redirecionar para login se não estiver logado
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/login");
      return;
    }
  }, [user, authLoading, setLocation]);

  // Primeiro acesso: redirecionar para onboarding se ainda não completou (usa perfil do banco)
  useEffect(() => {
    if (authLoading || !user || profileLoading) return;
    if (!profile?.onboardingCompleted) {
      setLocation("/onboarding?new=1");
    }
  }, [user, authLoading, profileLoading, profile?.onboardingCompleted, setLocation]);

  const handleVerDetalhes = (editalId: string) => {
    if (!canAccessEditalCatalog(entitlements, editalId)) {
      toast.error(subscriptionUpgradeMessage("editais_catalog"));
      setLocation("/planos");
      return;
    }
    setLocation(`/edital/${editalId}`);
  };

  // Função para gerar proposta com IA
  const handleGerarProposta = async (editalId: string) => {
    if (!user) {
      toast.error("Faça login para gerar uma proposta");
      return;
    }
    if (!proFeatures) {
      toast.error(subscriptionUpgradeMessage("propostas"));
      setLocation("/planos");
      return;
    }

    if (!editalId) {
      toast.error("ID do edital não encontrado");
      return;
    }

    try {
      setGerandoProposta(editalId);
      toast.loading("Criando proposta...", { id: `gerar-proposta-${editalId}` });

      const proposta = await gerarPropostaComIA(editalId, user.id, user, profile);

      toast.success("Proposta criada com sucesso!", { id: `gerar-proposta-${editalId}` });
      setLocation(`/propostas/${proposta.id}`);
    } catch (error) {
      console.error("Erro ao criar proposta:", error);
      toast.error(
        error instanceof Error ? error.message : "Erro ao criar proposta",
        { id: `gerar-proposta-${editalId}` }
      );
    } finally {
      setGerandoProposta(null);
    }
  };

  const isEditalAtivo = (edital: DatabaseEdital): boolean =>
    isEditalAtivoByDeadlines({
      timeline_estimada: edital.timeline_estimada,
      prazo_inscricao: edital.prazo_inscricao,
      data_encerramento: edital.data_encerramento,
      criado_em: edital.criado_em,
      status: edital.status,
      titulo: edital.titulo,
      descricao: edital.descricao,
      sobre_programa: edital.sobre_programa,
      numero: edital.numero,
    });

  // Adicionar pais/flag para filtros (getPaisFromEdital)
  const editaisComPais = editaisRawForList.map((e) => ({ ...e, ...getPaisFromEdital(e) }));

  const passesCatalogoBaseFilters = (edital: (typeof editaisComPais)[number]) => {
    // Quando "Apenas indicações" estiver ligado, NÃO aplicar filtros "fortes".
    if (!apenasIndicacoes) {
      if (!mostrarInativos && !isEditalAtivo(edital)) {
        return false;
      }

      if (!ignorarFiltroPerfil && profile && !profileLoading) {
        const userType = profile.userType;

        if (userType === "pesquisador" && edital.is_researcher === false) {
          return false;
        }

        if (userType === "pessoa-empresa" && edital.is_company === false) {
          return false;
        }

        if (userType === "ambos") {
          if (filtroTipoEdital === "pesquisadores" && edital.is_researcher === false) {
            return false;
          }
          if (filtroTipoEdital === "empresas" && edital.is_company === false) {
            return false;
          }
        }
      }
    }

    return true;
  };

  // Base do catálogo (ativo + perfil) — usada nos cards de stats, independente de busca/área.
  const editaisCatalogoBase = editaisComPais.filter(passesCatalogoBaseFilters);

  // Lista consultável: catálogo base + busca, área e indicações.
  const editaisFiltrados = editaisCatalogoBase.filter((edital) => {
    const buscaL = busca.toLowerCase();
    const matchBusca =
      (edital.titulo || "").toLowerCase().includes(buscaL) ||
      (edital.orgao?.toLowerCase() || "").includes(buscaL) ||
      (edital.area?.toLowerCase() || "").includes(buscaL) ||
      (edital.descricao?.toLowerCase() || "").includes(buscaL);

    const matchArea = editalMatchesArea(edital, filtroArea);
    const matchIndicacoes = !apenasIndicacoes || indicacoesMap.has(edital.id);

    return matchBusca && matchArea && matchIndicacoes;
  });

  const editaisFiltradosOrdenados = (() => {
    const list = [...editaisFiltrados];

    // Quando estiver filtrando apenas indicações, a ordem sempre prioriza score.
    if (apenasIndicacoes) {
      return list.sort((a, b) => {
        const sa = indicacoesMap.get(a.id)?.score ?? 0;
        const sb = indicacoesMap.get(b.id)?.score ?? 0;
        if (sb !== sa) return sb - sa;
        const da = a.data_encerramento ? new Date(a.data_encerramento).getTime() : Number.POSITIVE_INFINITY;
        const db = b.data_encerramento ? new Date(b.data_encerramento).getTime() : Number.POSITIVE_INFINITY;
        return da - db;
      });
    }

    if (ordenacao === "indicacoes") {
      // “Inteligência” aplicada na lista: indicados primeiro, depois por score.
      return list.sort((a, b) => {
        const ia = indicacoesMap.has(a.id);
        const ib = indicacoesMap.has(b.id);
        if (ia !== ib) return ia ? -1 : 1;
        const sa = indicacoesMap.get(a.id)?.score ?? 0;
        const sb = indicacoesMap.get(b.id)?.score ?? 0;
        if (sb !== sa) return sb - sa;
        return 0;
      });
    }

    // “Recentes”: mantém a ordem padrão que já veio do backend (criado_em desc)
    return list;
  })();

  const totalPages = Math.max(1, Math.ceil(editaisFiltradosOrdenados.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pageNumbers = useMemo(
    () => getDashboardPageNumbers(safePage, totalPages),
    [safePage, totalPages]
  );

  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleEditais = editaisFiltradosOrdenados.slice(pageStart, pageStart + PAGE_SIZE);
  const editais: EditalDisplay[] = visibleEditais.map((edital) => {
    const { pais, flag } = getPaisFromEdital(edital);
    const status = getStatusFromEdital(edital);
    const prazo = formatPrazo(edital.data_encerramento);
    return {
      ...edital,
      prazo,
      pais,
      flag,
      status,
      elegivel: true,
    };
  });

  // Mostrar loading só na primeira carga; se der erro, não travar em loading e mostrar retry
  const listLoading = apenasIndicacoes
    ? indicacoesQuery.isLoading && editaisIndicadosRaw.length === 0
    : editaisListQuery.isLoading && editaisRaw.length === 0;
  const listError = editaisListQuery.isError;
  const indicacoesErrorMessage =
    indicacoesQuery.error instanceof Error ? indicacoesQuery.error.message : indicacoesQuery.isError ? "Erro ao carregar indicações." : "";
  const loading = listLoading && !listError;

  const goToPage = (page: number) => {
    const next = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(next);
    document.getElementById("dashboard-editais-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const stats = useMemo(() => {
    const arrecadacao = computeArrecadacaoCatalogo(editaisCatalogoBase);
    return {
      editaisAtivos: editaisCatalogoBase.length,
      emAnalise: editaisCatalogoBase.filter((e) => getStatusFromEdital(e) === "em_analise").length,
      indicacoes: (indicacoesQuery.data ?? []).length,
      arrecadacao,
      arrecadacaoDisplay: formatArrecadacaoResumo(arrecadacao.totalBRL),
    };
  }, [editaisCatalogoBase, indicacoesQuery.data]);
  const areaSelecionada =
    AREA_FILTER_OPTIONS.find((opt) => opt.value === filtroArea)?.label ?? "Todas as áreas";
  const tipoSelecionado =
    filtroTipoEdital === "pesquisadores"
      ? "Pesquisadores"
      : filtroTipoEdital === "empresas"
      ? "Empresas"
      : "Todos os tipos";
  const filtrosAtivos = [
    busca.trim() ? "Busca" : null,
    filtroArea !== "todos" ? "Área" : null,
    filtroTipoEdital !== "todos" ? "Tipo" : null,
    mostrarInativos ? "Inativos" : null,
    apenasIndicacoes ? "Indicações" : null,
    ignorarFiltroPerfil ? "Fora do perfil" : null,
  ].filter(Boolean).length;

  // Não renderizar se não estiver logado (está redirecionando)
  if (!authLoading && !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <Header />
      <main id="main-content" className="container py-8">
        {/* Page Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[color:var(--institutional-line)] pb-6">
          <div>
            <p className="institutional-kicker mb-2">Portal de instrumentos</p>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Painel de Fomento</h1>
            <p className="text-sm md:text-base text-gray-700">Consulta estruturada de editais, prazos, requisitos e indicações para apoio à decisão.</p>
          </div>
        </div>

        {/* Referral Banner */}
        <Link href="/referencia" className="block mb-6">
          <div className="institutional-surface rounded-md p-4 text-gray-900 transition-colors hover:border-primary">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-sm bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                  <Share2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Rede de acesso</p>
                  <p className="text-sm text-gray-600">Compartilhe o acesso à plataforma com organizações e equipes parceiras.</p>
                </div>
              </div>
              <span className="text-sm font-medium underline underline-offset-2 sm:no-underline">
                Ver acesso →
              </span>
            </div>
          </div>
        </Link>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-gray-600">Carregando editais...</span>
          </div>
        ) : listError && editaisRaw.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 max-w-lg mx-auto">
            <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
            <p className="text-gray-700 text-center mb-2">Não foi possível carregar os editais a partir de editais_corretos.</p>
            {editaisListQuery.error != null ? (
              <p className="text-xs text-gray-500 break-words w-full text-center mb-4 font-mono">
                {editaisListQuery.error instanceof Error
                  ? editaisListQuery.error.message
                  : "Erro ao carregar editais."}
              </p>
            ) : null}
            <p className="text-sm text-gray-600 text-center mb-4">
              Se a sessão expirou, saia e entre de novo. Se persistir, confira se o backend está rodando em{" "}
              <code className="text-xs bg-gray-100 px-1 rounded">localhost:8080</code>.
            </p>
            <Button onClick={() => void editaisListQuery.refetch()} variant="outline">
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            {indicacoesErrorMessage && (
              <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="font-medium">Indicações indisponíveis no momento.</div>
                <div className="mt-1 break-words">{indicacoesErrorMessage}</div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  onClick={() => void indicacoesQuery.refetch()}
                  disabled={indicacoesQuery.isFetching}
                >
                  Tentar atualizar indicações
                </Button>
              </div>
            )}

            {!proFeatures && !profileLoading && (
              <UpgradePlanBanner
                message={`Plano ${entitlements.plan_name}: ${catalogUsageLabel ? `${catalogUsageLabel}. ` : ""}${subscriptionUpgradeMessage("editais_catalog")}${
                  catalogLockedCount > 0
                    ? ` Há mais ${catalogLockedCount} edital${catalogLockedCount === 1 ? "" : "is"} no catálogo Pro.`
                    : ""
                } Assine o Pro para catálogo ilimitado e recursos de IA.`}
              />
            )}

            {/* Stats */}
            <dl className={`mb-8 grid gap-3 sm:grid-cols-2 ${proFeatures ? "xl:grid-cols-4" : "xl:grid-cols-2"}`}>
              <div className="relative overflow-hidden rounded-sm border border-[color:var(--institutional-line)] bg-white px-5 py-4 shadow-sm">
                <div className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />
                <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Catálogo</dt>
                <dd className="mt-3 flex items-end justify-between gap-4">
                  <span className="text-4xl font-semibold leading-none tracking-tight text-gray-950">{stats.editaisAtivos}</span>
                  <span className="max-w-[8rem] text-right text-sm leading-snug text-gray-600">
                    {proFeatures
                      ? "Instrumentos disponíveis"
                      : catalogUsageLabel || `Plano gratuito · até ${FREE_EDITAIS_PER_MONTH}/mês`}
                  </span>
                </dd>
              </div>

              {proFeatures && (
              <div className="relative overflow-hidden rounded-sm border border-[color:var(--institutional-line)] bg-white px-5 py-4 shadow-sm">
                <div className="absolute inset-y-0 left-0 w-1 bg-emerald-500" aria-hidden="true" />
                <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Arrecadação</dt>
                <dd className="mt-3 flex items-end justify-between gap-4">
                  <span
                    className="text-4xl font-semibold leading-none tracking-tight text-gray-950"
                    title={stats.arrecadacaoDisplay.detail}
                  >
                    {stats.arrecadacaoDisplay.main}
                  </span>
                  <span className="max-w-[8rem] text-right text-sm leading-snug text-gray-600">
                    {stats.arrecadacao.editaisComValor > 0
                      ? `Estimativa em ${stats.arrecadacao.editaisComValor} edital${stats.arrecadacao.editaisComValor === 1 ? "" : "is"} ativo${stats.arrecadacao.editaisComValor === 1 ? "" : "s"}`
                      : "Sem valores identificados nos editais ativos"}
                  </span>
                </dd>
              </div>
              )}

              {proFeatures && (
              <div className="relative overflow-hidden rounded-sm border border-[color:var(--institutional-line)] bg-white px-5 py-4 shadow-sm">
                <div className="absolute inset-y-0 left-0 w-1 bg-[color:var(--attention)]" aria-hidden="true" />
                <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Recomendação</dt>
                <dd className="mt-3 flex items-end justify-between gap-4">
                  <span className="text-4xl font-semibold leading-none tracking-tight text-gray-950">{stats.indicacoes}</span>
                  <span className="max-w-[8rem] text-right text-sm leading-snug text-gray-600">Indicações para você</span>
                </dd>
              </div>
              )}

              {proFeatures && (
              <div className="relative overflow-hidden rounded-sm border border-[color:var(--institutional-line)] bg-white px-5 py-4 shadow-sm">
                <div className="absolute inset-y-0 left-0 w-1 bg-gray-400" aria-hidden="true" />
                <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Acompanhamento</dt>
                <dd className="mt-3 flex items-end justify-between gap-4">
                  <span className="text-4xl font-semibold leading-none tracking-tight text-gray-950">{stats.emAnalise}</span>
                  <span className="max-w-[8rem] text-right text-sm leading-snug text-gray-600">Em análise</span>
                </dd>
              </div>
              )}
            </dl>

        <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="institutional-surface sticky top-24 rounded-md p-5">
              <div className="mb-5 border-b border-border pb-4">
                <p className="institutional-kicker mb-2">Filtros de consulta</p>
                <h2 className="text-xl font-bold text-gray-900">Instrumentos disponíveis</h2>
                <p className="mt-2 text-sm text-gray-600">
                  {editaisFiltradosOrdenados.length} resultado(s). {filtrosAtivos > 0 ? `${filtrosAtivos} filtro(s) ativo(s).` : "Sem filtros adicionais."}
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <Label className="mb-2 block text-sm font-semibold text-gray-800">Busca</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Título, órgão ou área"
                      className="pl-9"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block text-sm font-semibold text-gray-800">Ordenação</Label>
                  <select
                    className="w-full rounded-sm border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={ordenacao}
                    onChange={(e) => setOrdenacao(e.target.value as "recentes" | "indicacoes")}
                  >
                    <option value="indicacoes">Recomendações primeiro</option>
                    <option value="recentes">Mais recentes primeiro</option>
                  </select>
                </div>

                {profile && !profileLoading && profile.userType === "ambos" && (
                  <div>
                  <Label className="mb-2 block text-sm font-semibold text-gray-800">Público atendido</Label>
                    <div className="space-y-2">
                      {[
                        { value: "todos" as const, label: "Todos os tipos" },
                        { value: "pesquisadores" as const, label: "Pesquisadores" },
                        { value: "empresas" as const, label: "Empresas" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setFiltroTipoEdital(opt.value)}
                          className={`w-full rounded-sm border px-3 py-2 text-left text-sm transition-colors ${
                            filtroTipoEdital === opt.value
                              ? "border-primary bg-secondary text-primary"
                              : "border-border bg-white text-gray-700 hover:border-primary"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="mb-2 block text-sm font-semibold text-gray-800">Área temática</Label>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {AREA_FILTER_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFiltroArea(opt.value)}
                        className={`w-full rounded-sm border px-3 py-2 text-left text-sm transition-colors ${
                          filtroArea === opt.value
                            ? "border-primary bg-secondary text-primary"
                            : "border-border bg-white text-gray-700 hover:border-primary"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 border-t border-border pt-4">
                  <div className="flex items-start gap-2">
                    <Checkbox id="mostrar-inativos" checked={mostrarInativos} onCheckedChange={(checked) => setMostrarInativos(checked === true)} />
                    <Label htmlFor="mostrar-inativos" className="text-sm leading-snug text-gray-700">
                      Mostrar editais com prazo encerrado
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="match-alto"
                      checked={apenasIndicacoes}
                      disabled={!proFeatures}
                      onCheckedChange={(checked) => proFeatures && setApenasIndicacoes(checked === true)}
                    />
                    <Label htmlFor="match-alto" className="text-sm leading-snug text-gray-700">
                      Apenas indicações{!proFeatures ? " (Pro)" : ""}
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox id="ignorar-perfil" checked={ignorarFiltroPerfil} onCheckedChange={(checked) => setIgnorarFiltroPerfil(checked === true)} />
                    <Label htmlFor="ignorar-perfil" className="text-sm leading-snug text-gray-700">
                      Incluir editais fora do meu perfil
                    </Label>
                  </div>
                </div>

                <Button type="button" className="w-full" onClick={() => void indicacoesQuery.refetch()} disabled={indicacoesQuery.isFetching}>
                  {indicacoesQuery.isFetching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Atualizando
                    </>
                  ) : (
                    "Atualizar indicações"
                  )}
                </Button>
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="mb-5 flex flex-col gap-3 lg:hidden">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar editais..."
                  className="pl-10"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <Sheet open={filtrosSheetOpen} onOpenChange={setFiltrosSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full justify-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filtros
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-md overflow-hidden">
                  <SheetHeader>
                    <SheetTitle>Filtros</SheetTitle>
                  </SheetHeader>
                  <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 pb-5">
                    <div>
                      <Label className="mb-2 block text-sm font-medium text-gray-700">Ordenação</Label>
                      <select
                        className="w-full rounded-sm border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        value={ordenacao}
                        onChange={(e) => setOrdenacao(e.target.value as "recentes" | "indicacoes")}
                      >
                        <option value="indicacoes">Ordenar por recomendações</option>
                        <option value="recentes">Ordenar por recentes</option>
                      </select>
                    </div>
                    <div>
                      <Label className="mb-2 block text-sm font-medium text-gray-700">Área</Label>
                      <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                        {AREA_FILTER_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setFiltroArea(opt.value)}
                            className={`flex items-center gap-3 rounded-sm px-4 py-3 text-left transition-colors ${
                              filtroArea === opt.value ? "border border-border bg-secondary text-primary" : "border border-transparent bg-white text-gray-700 hover:bg-secondary"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {profile && !profileLoading && profile.userType === "ambos" && (
                      <div>
                        <Label className="mb-2 block text-sm font-medium text-gray-700">Público atendido</Label>
                        <div className="flex flex-col gap-1">
                          {[
                            { value: "todos" as const, label: "Todos os tipos" },
                            { value: "pesquisadores" as const, label: "Pesquisadores" },
                            { value: "empresas" as const, label: "Empresas" },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setFiltroTipoEdital(opt.value)}
                              className={`flex items-center gap-3 rounded-sm px-4 py-3 text-left transition-colors ${
                                filtroTipoEdital === opt.value ? "border border-border bg-secondary text-primary" : "border border-transparent bg-white text-gray-700 hover:bg-secondary"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Checkbox id="mostrar-inativos-mobile" checked={mostrarInativos} onCheckedChange={(checked) => setMostrarInativos(checked === true)} />
                      <Label htmlFor="mostrar-inativos-mobile" className="cursor-pointer text-sm text-gray-700">
                        Mostrar editais inativos
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="match-alto-mobile"
                        checked={apenasIndicacoes}
                        disabled={!proFeatures}
                        onCheckedChange={(checked) => proFeatures && setApenasIndicacoes(checked === true)}
                      />
                      <Label htmlFor="match-alto-mobile" className="cursor-pointer text-sm text-gray-700">
                        Apenas indicações{!proFeatures ? " (Pro)" : ""}
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="ignorar-perfil-mobile" checked={ignorarFiltroPerfil} onCheckedChange={(checked) => setIgnorarFiltroPerfil(checked === true)} />
                      <Label htmlFor="ignorar-perfil-mobile" className="cursor-pointer text-sm text-gray-700">
                        Incluir editais fora do meu perfil
                      </Label>
                    </div>
                    <Button className="w-full" onClick={() => setFiltrosSheetOpen(false)}>
                      Aplicar filtros
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <div className="mb-5 flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-end">
              <div>
                <p className="institutional-kicker mb-2">Resultado da consulta</p>
                <h2 className="text-2xl font-bold text-gray-900">{editaisFiltradosOrdenados.length} instrumentos disponíveis</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Área: {areaSelecionada} · Público: {tipoSelecionado}
                  {editaisFiltradosOrdenados.length > 0 && (
                    <>
                      {" "}
                      · Página {safePage} de {totalPages} ({editaisFiltradosOrdenados.length} editais)
                    </>
                  )}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </div>

            <div id="dashboard-editais-grid" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {editais.map((edital) => {
                const indicacao = indicacoesMap.get(edital.id);
                const isIndicado = indicacao != null;
                const isResearcher = edital.is_researcher === true;
                const isCompany = edital.is_company === true;
                const locked = !canAccessEditalCatalog(entitlements, edital.id);
                const valorFormatado = formatValorProjeto(edital.valor_projeto || edital.valor);
                const prazoLabel = getPrazoInscricaoDisplayPreferindoTimeline(
                  edital.prazo_inscricao,
                  edital.timeline_estimada,
                  { data_encerramento: edital.data_encerramento, criado_em: edital.criado_em },
                ).display;
                const typeLabel = isResearcher && isCompany
                  ? "Pesquisadores e empresas"
                  : isResearcher
                  ? "Pesquisadores"
                  : isCompany
                  ? "Empresas"
                  : "Público amplo";

                const cardClassName = `group relative flex min-h-[22rem] flex-col overflow-hidden rounded-md border p-5 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-[26rem] ${
                  locked
                    ? "cursor-not-allowed border-border bg-gray-50 opacity-80"
                    : isIndicado
                      ? "border-primary/40 bg-secondary hover:border-primary"
                      : "border-border bg-white hover:border-primary/60"
                }`;

                const cardInner = (
                  <>
                    {locked && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/75 px-4 text-center backdrop-blur-[1px]">
                        <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
                        <p className="text-sm font-medium text-gray-800">Limite do plano gratuito</p>
                        <p className="text-xs text-gray-600">Assine o Pro para ver este edital</p>
                      </div>
                    )}
                    <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
                      <Badge variant="outline" className="border-border bg-white text-primary">
                        {typeLabel}
                      </Badge>
                      {isIndicado && (
                        <Badge className="bg-primary text-white">
                          <Sparkles className="h-3 w-3" />
                          {indicacao?.score ?? 0}
                        </Badge>
                      )}
                    </div>

                    <div className="min-h-0 flex-1 overflow-hidden">
                      <p className="mb-2 line-clamp-1 break-words text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                        {edital.orgao || edital.pais || "Órgão não informado"}
                      </p>
                      <h3
                        className={`line-clamp-3 break-words text-lg font-bold leading-snug ${locked ? "text-gray-700" : "text-gray-950 group-hover:text-primary"}`}
                        title={edital.titulo}
                      >
                        {edital.titulo}
                      </h3>
                      {edital.descricao && (
                        <p
                          className="mt-2 line-clamp-2 break-words text-sm leading-relaxed text-gray-600"
                          title={edital.descricao}
                        >
                          {edital.descricao}
                        </p>
                      )}
                    </div>

                    {isIndicado && (indicacao?.motivos?.length ?? 0) > 0 && (
                      <div className="mt-3 flex shrink-0 flex-wrap gap-2">
                        {indicacao!.motivos.slice(0, 2).map((m, idx) => (
                          <Badge key={idx} variant="outline" className="bg-white text-xs text-primary">
                            {m}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="mt-auto shrink-0 space-y-2 border-t border-border pt-4 text-sm text-gray-700">
                      {valorFormatado.display !== "Não informado" && (
                        <div className="flex min-w-0 items-start gap-2">
                          <DollarSign className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                          <span
                            className="min-w-0 flex-1 break-words line-clamp-2 font-semibold text-gray-900"
                            title={valorFormatado.display}
                          >
                            {valorFormatado.display}
                          </span>
                        </div>
                      )}
                      <div className="flex min-w-0 items-start gap-2">
                        <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                        <span className="min-w-0 flex-1 break-words line-clamp-2" title={`Prazo: ${prazoLabel}`}>
                          Prazo: {prazoLabel}
                        </span>
                      </div>
                      {edital.area && (
                        <div className="flex min-w-0 items-start gap-2">
                          <Target className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                          <span className="min-w-0 flex-1 break-words line-clamp-2" title={edital.area}>
                            {edital.area}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                );

                if (locked) {
                  return (
                    <div
                      key={edital.id}
                      className={cardClassName}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleVerDetalhes(edital.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleVerDetalhes(edital.id);
                        }
                      }}
                    >
                      {cardInner}
                    </div>
                  );
                }

                return (
                  <Link key={edital.id} href={`/edital/${edital.id}`} className={cardClassName}>
                    {cardInner}
                  </Link>
                );
              })}
            </div>

            {editaisFiltradosOrdenados.length > PAGE_SIZE && (
              <nav className="mt-8 flex flex-col items-center gap-3" aria-label="Paginação do catálogo">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        size="default"
                        className={`gap-1 px-2.5 ${safePage <= 1 ? "pointer-events-none opacity-50" : ""}`}
                        aria-label="Página anterior"
                        onClick={(e) => {
                          e.preventDefault();
                          if (safePage > 1) goToPage(safePage - 1);
                        }}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Anterior</span>
                      </PaginationLink>
                    </PaginationItem>
                    {pageNumbers.map((item, idx) =>
                      item === "ellipsis" ? (
                        <PaginationItem key={`ellipsis-${idx}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={item}>
                          <PaginationLink
                            href="#"
                            isActive={item === safePage}
                            onClick={(e) => {
                              e.preventDefault();
                              goToPage(item);
                            }}
                          >
                            {item}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    )}
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        size="default"
                        className={`gap-1 px-2.5 ${safePage >= totalPages ? "pointer-events-none opacity-50" : ""}`}
                        aria-label="Próxima página"
                        onClick={(e) => {
                          e.preventDefault();
                          if (safePage < totalPages) goToPage(safePage + 1);
                        }}
                      >
                        <span className="hidden sm:inline">Próxima</span>
                        <ChevronRight className="h-4 w-4" />
                      </PaginationLink>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </nav>
            )}
          </section>
        </div>

            {editais.length === 0 && !loading && !listError && (
              <div className="text-center py-12 max-w-2xl mx-auto px-2">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                {editaisRawForList.length === 0 ? (
                  <>
                    <p className="text-gray-800 font-medium mb-2">Nada para exibir na lista (fonte vazia).</p>
                    <p className="text-sm text-gray-600 mb-3">
                      O feed lê <code className="text-xs bg-gray-100 px-1 rounded">editais_corretos</code> (até 250
                      itens) e, se houver, mescla com indicações. A opção &quot;Mostrar inativos&quot; só muda o filtro de
                      prazo; não cria linhas. Com &quot;Apenas indicações&quot; e sem indicações em{" "}
                      <code className="text-xs bg-gray-100 px-1">edital_indicacoes</code>, a fonte fica vazia — desative.
                      Se no SQL do Supabase há linhas e aqui 0, confira o mesmo projeto em <code className="text-xs bg-gray-100 px-1">.env</code> e execute no banco
                      a migration <code className="text-xs bg-gray-100 px-1">scripts/db/migration-editais-corretos-rls-public-read.sql</code> (policy de
                      <code>SELECT</code> para <code>anon</code>).
                    </p>
                    {apenasIndicacoes && editaisIndicadosRaw.length === 0 && editaisRaw.length > 0 && (
                      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3 mb-3 text-left">
                        Há {editaisRaw.length} edital(is) no banco, mas &quot;Apenas indicações&quot; está ativo e você não
                        possui indicações carregadas. Desmarque a opção para ver o feed completo.
                      </p>
                    )}
                    <Button type="button" variant="outline" onClick={() => void editaisListQuery.refetch()}>
                      Recarregar lista
                    </Button>
                  </>
                ) : editaisFiltrados.length === 0 && editaisRawForList.length > 0 ? (
                  <div className="text-left text-sm text-gray-600 space-y-2">
                    <p>
                      <span className="font-medium text-gray-800">
                        {editaisRawForList.length} edital(is) na lista
                      </span>{" "}
                      antes do filtro{indicacoesMap.size > 0 ? ` (inclui itens com indicação no merge)` : ""}, mas{" "}
                      <span className="font-medium">0</span> após os filtros atuais. &quot;Mostrar inativos&quot; só tira a
                      regra de prazo; não desliga filtro de perfil nem &quot;Apenas indicações&quot;.
                    </p>
                    <p className="list-disc pl-5 space-y-1">
                      {apenasIndicacoes && (
                        <li>
                          Desative &quot;Apenas indicações&quot; se quiser o catálogo inteiro, ou clique em &quot;Atualizar
                          indicações&quot;.
                        </li>
                      )}
                      {filtroArea !== "todos" && (
                        <li>Área: está em &quot;{AREA_FILTER_OPTIONS.find((o) => o.value === filtroArea)?.label}&quot; — use &quot;Todas as áreas&quot;.</li>
                      )}
                      {busca.trim() !== "" && <li>Remova o texto da busca.</li>}
                      {!apenasIndicacoes && !ignorarFiltroPerfil && profile && (
                        <li>
                          Perfil ({profile.userType}): editais com <code>is_researcher</code> ou <code>is_company</code>{" "}
                          <span className="font-medium">false</span> (explícito) somem. Marque &quot;Incluir editais fora do meu
                          perfil&quot;.
                        </li>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center pt-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setFiltroArea("todos")}>
                        Área: todas
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setBusca("")}>
                        Limpar busca
                      </Button>
                      {apenasIndicacoes && (
                        <Button type="button" variant="secondary" size="sm" onClick={() => setApenasIndicacoes(false)}>
                          Desligar: só indicações
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => setIgnorarFiltroPerfil(true)}
                        disabled={ignorarFiltroPerfil}
                      >
                        Incluir fora do perfil
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-600">Nenhum edital a exibir. Ajuste os filtros acima.</p>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
