import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  Calendar,
  FileEdit,
  FolderKanban,
  Loader2,
  Sparkles,
  Target,
} from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscriptionEntitlements } from "@/hooks/useSubscriptionEntitlements";
import { subscriptionUpgradeMessage } from "@/lib/subscriptionEntitlements";
import {
  fetchProjeto,
  gerarPropostaAdaptadaFromProjeto,
  matchEditaisForProjeto,
  type Projeto,
  type ProjetoEditalMatch,
} from "@/lib/projetosApi";
import { formatValorProjeto } from "@/lib/editalFormatters";
import { getPrazoInscricaoDisplayPreferindoTimeline } from "@/lib/editalSubmissionDeadline";

export default function ProjetoEditais() {
  const params = useParams<{ id: string }>();
  const id = String(params.id || "");
  const { user, loading: authLoading } = useAuth();
  const { canUsePropostas } = useSubscriptionEntitlements();
  const [, setLocation] = useLocation();

  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [matches, setMatches] = useState<ProjetoEditalMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [candidatandoEditalId, setCandidatandoEditalId] = useState<string | null>(null);
  const [adaptProgress, setAdaptProgress] = useState<{
    current: number;
    total: number;
    field: string;
  } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLocation(`/login?redirect=/projetos/${encodeURIComponent(id)}/editais`);
      return;
    }
    if (!id) return;

    void (async () => {
      setLoading(true);
      setMatching(true);
      try {
        const row = await fetchProjeto(id);
        setProjeto(row);
        const found = await matchEditaisForProjeto(id, 40);
        setMatches(found);
        if (!found.length) {
          toast.message("Nenhum edital compatível encontrado com o texto deste projeto");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao carregar editais do projeto");
      } finally {
        setLoading(false);
        setMatching(false);
      }
    })();
  }, [user, authLoading, id, setLocation]);

  const refreshMatches = async () => {
    if (!id) return;
    setMatching(true);
    try {
      const found = await matchEditaisForProjeto(id, 40);
      setMatches(found);
      if (!found.length) {
        toast.message("Nenhum edital compatível encontrado");
      } else {
        toast.success(`${found.length} editais ranqueados`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na busca");
    } finally {
      setMatching(false);
    }
  };

  const handleCandidatar = async (editalId: string, editalTitulo?: string) => {
    if (!user || !projeto) return;
    if (!canUsePropostas) {
      toast.error(subscriptionUpgradeMessage("propostas"));
      setLocation("/planos");
      return;
    }
    setCandidatandoEditalId(editalId);
    setAdaptProgress({ current: 0, total: 0, field: "Preparando…" });
    const toastId = `gerar-proposta-${editalId}`;
    toast.loading(
      editalTitulo
        ? `Adaptando seções ao edital “${editalTitulo}”…`
        : "Adaptando seções do projeto ao edital com IA…",
      { id: toastId },
    );
    try {
      const { proposta, created, adapted, fieldsAdapted, fieldsFailed, message } =
        await gerarPropostaAdaptadaFromProjeto({
          projetoId: projeto.id,
          editalId,
          force: true,
          onProgress: (p) => {
            setAdaptProgress(p);
            if (p.total > 0 && p.current > 0) {
              toast.loading(`${p.current} de ${p.total}: ${p.field}`, { id: toastId });
            }
          },
        });

      if (!adapted && !created) {
        toast.message(message || "Abrindo proposta existente", { id: toastId });
      } else {
        const n = fieldsAdapted?.length ?? 0;
        const failed = fieldsFailed?.length ?? 0;
        toast.success(
          failed > 0
            ? `Proposta pronta: ${n} seções adaptadas (${failed} mantiveram rascunho). Revise no editor.`
            : `Proposta escrita com ${n} seções adaptadas ao edital.`,
          { id: toastId },
        );
      }
      setLocation(`/propostas/${proposta.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar proposta", { id: toastId });
    } finally {
      setCandidatandoEditalId(null);
      setAdaptProgress(null);
    }
  };

  if (!authLoading && !user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[color:var(--background)]">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href="/meus-projetos">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Meus projetos
            </Button>
          </Link>
          {id && (
            <Link href={`/projetos/${id}`}>
              <Button variant="ghost">
                <FolderKanban className="mr-2 h-4 w-4" />
                Texto do projeto
              </Button>
            </Link>
          )}
          {id && (
            <Link href={`/dashboard?projeto=${encodeURIComponent(id)}`}>
              <Button variant="ghost">Ver no painel</Button>
            </Link>
          )}
        </div>

        {loading || !projeto ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="mb-8 border-b border-border pb-6">
              <p className="institutional-kicker mb-2">Busca reversa</p>
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                Editais para “{projeto.titulo}”
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-600">
                Chamadas ranqueadas pelo texto deste projeto. Escolha um edital para escrever a proposta
                adaptada com IA, ou filtre o catálogo do painel pelo mesmo projeto.
              </p>
              <div className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={matching || !!candidatandoEditalId}
                  onClick={() => void refreshMatches()}
                >
                  {matching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Atualizar ranking
                </Button>
              </div>
            </div>

            {matching && matches.length === 0 ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : matches.length === 0 ? (
              <div className="rounded-md border border-border bg-white p-6 text-sm text-gray-600">
                Nenhum edital compatível. Enriqueça o texto do projeto e atualize o ranking.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {matches.map(({ score, motivos, edital }) => {
                  const prazo = getPrazoInscricaoDisplayPreferindoTimeline(
                    edital.prazo_inscricao,
                    edital.timeline_estimada,
                    { data_encerramento: edital.data_encerramento, criado_em: edital.criado_em },
                  ).display;
                  const valor = formatValorProjeto(edital.valor_projeto || edital.valor).display;
                  const busy = candidatandoEditalId === edital.id;
                  return (
                    <div
                      key={edital.id}
                      className="rounded-md border border-border bg-white p-4 transition-colors hover:border-primary"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {edital.orgao || "Órgão"}
                        </p>
                        <Badge className="bg-primary text-white">
                          <Sparkles className="h-3 w-3" />
                          {score}
                        </Badge>
                      </div>
                      <Link href={`/edital/${edital.id}`}>
                        <h2 className="line-clamp-3 font-bold text-gray-950 hover:underline">
                          {edital.titulo}
                        </h2>
                      </Link>
                      {motivos?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {motivos.slice(0, 3).map((m) => (
                            <Badge key={m} variant="outline" className="text-xs">
                              {m}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 space-y-1 text-sm text-gray-700">
                        {valor !== "Não informado" && <p>{valor}</p>}
                        <p className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {prazo}
                        </p>
                        {edital.area && (
                          <p className="flex items-center gap-1">
                            <Target className="h-3.5 w-3.5" />
                            {edital.area}
                          </p>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy || !!candidatandoEditalId}
                          onClick={() => void handleCandidatar(edital.id, edital.titulo || undefined)}
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <FileEdit className="h-3.5 w-3.5" />
                          )}
                          Escrever proposta adaptada
                        </Button>
                        <Link href={`/edital/${edital.id}`}>
                          <Button type="button" size="sm" variant="outline">
                            Ver edital
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {candidatandoEditalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-md border border-border bg-white p-6 shadow-lg">
            <div className="mb-3 flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="font-semibold text-gray-900">Adaptando proposta com IA</p>
            </div>
            {adaptProgress && adaptProgress.total > 0 ? (
              <>
                <p className="text-sm text-gray-600">
                  {adaptProgress.current} de {adaptProgress.total}: {adaptProgress.field}
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((adaptProgress.current / adaptProgress.total) * 100),
                      )}%`,
                    }}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-600">{adaptProgress?.field || "Preparando…"}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
