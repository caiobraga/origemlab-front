import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { 
  Search, Filter, Calendar, DollarSign, Target, AlertCircle,
  Sparkles, Loader2, Share2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
import { useEditaisIndicacoes } from "@/hooks/useEditaisIndicacoes";
import { formatValorProjeto, formatPrazoInscricao } from "@/lib/editalFormatters";
import {
  extrairDataMaisRecentePrazo,
  extrairDeadlineSubmissao,
  formatDatePtBR,
  getPrazoInscricaoSummary,
  normalizeText,
} from "@/lib/editalSubmissionDeadline";
import { gerarPropostaComIA } from "@/lib/propostasApi";

interface EditalDisplay extends DatabaseEdital {
  prazo: string;
  pais: string;
  flag: string;
  status: "novo" | "em_analise" | "submetido";
  elegivel: boolean;
}

export default function Dashboard() {
  const [filtroArea, setFiltroArea] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false); // Opção para mostrar editais inativos
  const [ignorarFiltroPerfil, setIgnorarFiltroPerfil] = useState(false); // Mostra editais mesmo com is_researcher/is_company incompatíveis
  const [filtroTipoEdital, setFiltroTipoEdital] = useState<"pesquisadores" | "empresas" | "todos">("todos"); // Filtro para tipo (quando usuário é "ambos")
  const [apenasIndicacoes, setApenasIndicacoes] = useState(false);
  const [ordenacao, setOrdenacao] = useState<"recentes" | "indicacoes">("indicacoes");
  const INCREMENTO_PAGINACAO = 5;
  const [visibleCount, setVisibleCount] = useState(15); // Paginação infinita: exibir 15 iniciais, depois +5 ao rolar
  const [gerandoProposta, setGerandoProposta] = useState<string | null>(null);
  const [filtrosSheetOpen, setFiltrosSheetOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const indicacoesQuery = useEditaisIndicacoes(user?.id, { limit: 12, autoRefresh: true });
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
  const editaisRaw = editaisListQuery.data ?? [];
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

  const editaisRawForList = apenasIndicacoes ? editaisIndicadosRaw : editaisRawMerged;

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

  // Resetar paginação quando filtros mudarem
  useEffect(() => {
    setVisibleCount(15);
  }, [busca, filtroArea, filtroTipoEdital, mostrarInativos, ignorarFiltroPerfil, apenasIndicacoes, ordenacao]);

  // Paginação infinita: carregar mais 5 editais quando o sentinel entrar na tela
  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => prev + INCREMENTO_PAGINACAO);
  }, []);

  const handleVerDetalhes = (editalId: string) => {
    setLocation(`/edital/${editalId}`);
  };

  // Função para gerar proposta com IA
  const handleGerarProposta = async (editalId: string) => {
    if (!user) {
      toast.error("Faça login para gerar uma proposta");
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

  // Função helper para verificar se um edital ainda está ativo
  // IMPORTANTE: Um edital é considerado ativo se QUALQUER um dos seguintes critérios for verdadeiro:
  // Regra principal: edital é "ativo" se ainda está dentro do prazo de submissão.
  // A data usada para filtrar deve ser a MESMA exibida no card (Prazo).
  const isEditalAtivo = (edital: DatabaseEdital): boolean => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // 0) Não esconder só porque `prazo_inscricao` está "Não informado".
    // Muitos editais ainda têm `data_encerramento` ou timeline válida; esconder aqui reduz demais a lista
    // e faz as indicações “sumirem” do feed.
    // (A validação real acontece nos passos abaixo, com fallbacks.)
    const prazoFormatado = formatPrazoInscricao(edital.prazo_inscricao);

    // 1) Submissão (timeline_estimada)
    const deadlineSubmissao = extrairDeadlineSubmissao(edital.timeline_estimada);
    if (deadlineSubmissao && !isNaN(deadlineSubmissao.getTime())) {
      const fimDoDia = new Date(deadlineSubmissao);
      fimDoDia.setHours(23, 59, 59, 999);
      return hoje.getTime() <= fimDoDia.getTime();
    }

    // 2) prazo_inscricao (quando não há timeline de submissão)
    const prazoSummary = getPrazoInscricaoSummary(edital.prazo_inscricao);
    if (prazoSummary.date) {
      const fimDoDia = new Date(prazoSummary.date);
      fimDoDia.setHours(23, 59, 59, 999);
      return hoje.getTime() <= fimDoDia.getTime();
    }

    // 3) data_encerramento (fallback)
    if (edital.data_encerramento) {
      const enc = new Date(edital.data_encerramento);
      if (!isNaN(enc.getTime())) {
      enc.setHours(23, 59, 59, 999);
        return hoje.getTime() <= enc.getTime();
      }
    }

    // 4) Sem datas parseáveis: não esconder o edital por default.
    // Só marcar como inativo quando o status explícito indica encerrado/finalizado.
    const statusLower = (edital.status || "").toLowerCase().trim();
    if (statusLower === "encerrado" || statusLower === "finalizado") return false;
    return true;
  };

  // Adicionar pais/flag para filtros (getPaisFromEdital)
  const editaisComPais = editaisRawForList.map((e) => ({ ...e, ...getPaisFromEdital(e) }));

  // Filtrar editais baseado no perfil do usuário e outros filtros
  const editaisFiltrados = editaisComPais.filter((edital) => {
    // Quando "Apenas indicações" estiver ligado, NÃO aplicar filtros "fortes".
    // A indicação já é a personalização — então não deve ser cortada por ativo/inativo nem pelo tipo do perfil.
    if (!apenasIndicacoes) {
      // Filtrar editais que já passaram da data de encerramento (a menos que mostrarInativos esteja ativo)
      if (!mostrarInativos && !isEditalAtivo(edital)) {
        return false;
      }

      // Filtro baseado no perfil do usuário (is_researcher ou is_company) — pode ocultar centenas de linhas
      if (!ignorarFiltroPerfil && profile && !profileLoading) {
        const userType = profile.userType;

        // Se o usuário é pesquisador, mostrar apenas editais onde is_researcher === true
        if (userType === "pesquisador") {
          // Se is_researcher é false ou null, não mostrar
          // Se is_researcher é true ou undefined (ainda não processado), mostrar
          if (edital.is_researcher === false) {
            return false;
          }
        }

        // Se o usuário é pessoa-empresa, mostrar apenas editais onde is_company === true
        if (userType === "pessoa-empresa") {
          // Se is_company é false ou null, não mostrar
          // Se is_company é true ou undefined (ainda não processado), mostrar
          if (edital.is_company === false) {
            return false;
          }
        }

        // Se o usuário é tipo "ambos", aplicar filtro baseado no filtroTipoEdital
        if (userType === "ambos") {
          if (filtroTipoEdital === "pesquisadores") {
            // Mostrar apenas editais onde is_researcher === true
            if (edital.is_researcher === false) {
              return false;
            }
          } else if (filtroTipoEdital === "empresas") {
            // Mostrar apenas editais onde is_company === true
            if (edital.is_company === false) {
              return false;
            }
          }
          // Se filtroTipoEdital === "todos", não filtrar por tipo
        }
      }
    }

    // Filtro de busca
    const buscaL = busca.toLowerCase();
    const matchBusca =
      (edital.titulo || "").toLowerCase().includes(buscaL) ||
      (edital.orgao?.toLowerCase() || "").includes(buscaL) ||
      (edital.area?.toLowerCase() || "").includes(buscaL) ||
      (edital.descricao?.toLowerCase() || "").includes(buscaL);

    // Filtro de área (Tecnologia, Saúde, Agronegócio, etc.)
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
    return editaisFiltrados;
  })();

  // Paginação: apenas os visíveis (scores calculados sob demanda)
  const visibleEditais = editaisFiltradosOrdenados.slice(0, visibleCount);
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
  const hasMore = visibleCount < editaisFiltradosOrdenados.length;

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !editaisFiltradosOrdenados.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && hasMore) {
          handleLoadMore();
        }
      },
      { rootMargin: "200px", threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, handleLoadMore, editaisFiltradosOrdenados.length]);

  const stats = {
    editaisAtivos: editaisFiltrados.length,
    emAnalise: editaisFiltrados.filter((e) => getStatusFromEdital(e) === "em_analise").length,
    indicacoes: (indicacoesQuery.data ?? []).length,
  };
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
              Erros comuns: RLS (sem policy de leitura para o anon) ou tabela/URL de outro projeto no .env.
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

            {/* Stats */}
            <dl className="mb-8 grid gap-3 sm:grid-cols-3">
              <div className="relative overflow-hidden rounded-sm border border-[color:var(--institutional-line)] bg-white px-5 py-4 shadow-sm">
                <div className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />
                <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Catálogo</dt>
                <dd className="mt-3 flex items-end justify-between gap-4">
                  <span className="text-4xl font-semibold leading-none tracking-tight text-gray-950">{stats.editaisAtivos}</span>
                  <span className="max-w-[8rem] text-right text-sm leading-snug text-gray-600">Instrumentos disponíveis</span>
                </dd>
              </div>

              <div className="relative overflow-hidden rounded-sm border border-[color:var(--institutional-line)] bg-white px-5 py-4 shadow-sm">
                <div className="absolute inset-y-0 left-0 w-1 bg-[color:var(--attention)]" aria-hidden="true" />
                <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Recomendação</dt>
                <dd className="mt-3 flex items-end justify-between gap-4">
                  <span className="text-4xl font-semibold leading-none tracking-tight text-gray-950">{stats.indicacoes}</span>
                  <span className="max-w-[8rem] text-right text-sm leading-snug text-gray-600">Indicações para você</span>
                </dd>
              </div>

              <div className="relative overflow-hidden rounded-sm border border-[color:var(--institutional-line)] bg-white px-5 py-4 shadow-sm">
                <div className="absolute inset-y-0 left-0 w-1 bg-gray-400" aria-hidden="true" />
                <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Acompanhamento</dt>
                <dd className="mt-3 flex items-end justify-between gap-4">
                  <span className="text-4xl font-semibold leading-none tracking-tight text-gray-950">{stats.emAnalise}</span>
                  <span className="max-w-[8rem] text-right text-sm leading-snug text-gray-600">Em análise</span>
                </dd>
              </div>
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
                    <Checkbox id="match-alto" checked={apenasIndicacoes} onCheckedChange={(checked) => setApenasIndicacoes(checked === true)} />
                    <Label htmlFor="match-alto" className="text-sm leading-snug text-gray-700">
                      Apenas indicações
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
                      <Checkbox id="match-alto-mobile" checked={apenasIndicacoes} onCheckedChange={(checked) => setApenasIndicacoes(checked === true)} />
                      <Label htmlFor="match-alto-mobile" className="cursor-pointer text-sm text-gray-700">
                        Apenas indicações
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
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => { setBusca(""); setFiltroArea("todos"); setFiltroTipoEdital("todos"); setApenasIndicacoes(false); }}>
                Limpar filtros
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {editais.map((edital) => {
                const indicacao = indicacoesMap.get(edital.id);
                const isIndicado = indicacao != null;
                const isResearcher = edital.is_researcher === true;
                const isCompany = edital.is_company === true;
                const valorFormatado = formatValorProjeto(edital.valor_projeto || edital.valor);
                const prazoLabel = (() => {
                  const deadlineSubmissao = extrairDeadlineSubmissao(edital.timeline_estimada);
                  if (deadlineSubmissao && !isNaN(deadlineSubmissao.getTime())) {
                    return `Até ${formatDatePtBR(deadlineSubmissao)}`;
                  }
                  const prazoSummary = getPrazoInscricaoSummary(edital.prazo_inscricao);
                  if (prazoSummary.date) {
                    return `Até ${formatDatePtBR(prazoSummary.date)}${prazoSummary.extraCount ? ` (+${prazoSummary.extraCount})` : ""}`;
                  }
                  const prazoFormatado = formatPrazoInscricao(edital.prazo_inscricao);
                  if (prazoFormatado.display !== "Não informado") return prazoFormatado.display;
                  return edital.prazo;
                })();
                const typeLabel = isResearcher && isCompany
                  ? "Pesquisadores e empresas"
                  : isResearcher
                  ? "Pesquisadores"
                  : isCompany
                  ? "Empresas"
                  : "Público amplo";

                return (
                  <Link
                    key={edital.id}
                    href={`/edital/${edital.id}`}
                    className={`group flex min-h-[22rem] flex-col rounded-md border p-5 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:aspect-square sm:min-h-0 ${
                      isIndicado
                        ? "border-primary/40 bg-secondary hover:border-primary"
                        : "border-border bg-white hover:border-primary/60"
                    }`}
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
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

                    <div className="min-h-0 flex-1">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                        {edital.orgao || edital.pais || "Órgão não informado"}
                      </p>
                      <h3 className="line-clamp-4 text-lg font-bold leading-tight text-gray-950 group-hover:text-primary">
                        {edital.titulo}
                      </h3>
                      {edital.descricao && (
                        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-gray-600">
                          {edital.descricao}
                        </p>
                      )}
                    </div>

                    {isIndicado && (indicacao?.motivos?.length ?? 0) > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {indicacao!.motivos.slice(0, 2).map((m, idx) => (
                          <Badge key={idx} variant="outline" className="bg-white text-xs text-primary">
                            {m}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm text-gray-700">
                      {valorFormatado.display !== "Não informado" && (
                        <div className="flex items-start gap-2">
                          <DollarSign className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                          <span className="line-clamp-1 font-semibold text-gray-900">{valorFormatado.display}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                        <span className="line-clamp-1">Prazo: {prazoLabel}</span>
                      </div>
                      {edital.area && (
                        <div className="flex items-start gap-2">
                          <Target className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                          <span className="line-clamp-1">{edital.area}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>

            {/* Sentinel para paginação infinita: ao rolar até aqui, carrega mais 5 editais */}
            {hasMore && (
              <div ref={loadMoreRef} className="flex justify-center py-6 min-h-[60px]" aria-hidden="true">
                <Loader2 className="w-6 h-6 animate-spin text-primary" aria-label="Carregando mais editais" />
              </div>
            )}

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
