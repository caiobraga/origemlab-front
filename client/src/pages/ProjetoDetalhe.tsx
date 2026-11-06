import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, Loader2, Save, Search } from "lucide-react";
import Header from "@/components/Header";
import ProjetoAbrangenciaField from "@/components/ProjetoAbrangenciaField";
import TextFieldWithAI from "@/components/TextFieldWithAI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscriptionEntitlements } from "@/hooks/useSubscriptionEntitlements";
import { subscriptionUpgradeMessage } from "@/lib/subscriptionEntitlements";
import {
  fetchProjeto,
  gerarPropostaAdaptadaFromProjeto,
  updateProjeto,
  type Projeto,
  type ProjetoPublicoAlvo,
  type ProjetoStatus,
} from "@/lib/projetosApi";
import {
  normalizeProjetoConteudo,
  PROJETO_ORIGEM_LABELS,
  PROJETO_SECTIONS,
  type ProjetoConteudo,
  type ProjetoOrigemTipo,
} from "@/lib/projetoFormFields";

export default function ProjetoDetalhe() {
  const params = useParams<{ id: string }>();
  const id = String(params.id || "");
  const { user, loading: authLoading } = useAuth();
  const { canUsePropostas } = useSubscriptionEntitlements();
  const [, setLocation] = useLocation();
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [titulo, setTitulo] = useState("");
  const [status, setStatus] = useState<ProjetoStatus>("rascunho");
  const [publico, setPublico] = useState<ProjetoPublicoAlvo>("ambos");
  const [conteudo, setConteudo] = useState<ProjetoConteudo>(normalizeProjetoConteudo(null));
  const [keywords, setKeywords] = useState("");
  const [abrangencia, setAbrangencia] = useState<string[]>([]);
  /** Só envia `abrangencia_ufs` quando o usuário mexeu na região. */
  const abrangenciaDirtyRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [candidatandoEditalId, setCandidatandoEditalId] = useState<string | null>(null);
  const [candidatandoLabel, setCandidatandoLabel] = useState("");
  const [adaptProgress, setAdaptProgress] = useState<{
    current: number;
    total: number;
    field: string;
  } | null>(null);
  const autoCandidatarDone = useRef(false);
  /** Evita refetch ao trocar de aba do browser (auth refresh cria novo objeto `user`). */
  const loadedIdRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);

  const formContext = useMemo(
    () => ({
      titulo,
      status,
      publico_alvo: publico,
      palavras_chave: keywords,
      conteudo,
    }),
    [titulo, status, publico, keywords, conteudo],
  );

  const markDirty = () => {
    dirtyRef.current = true;
  };

  useEffect(() => {
    if (authLoading || !user?.id || !id) return;

    const isFirstLoadForId = loadedIdRef.current !== id;
    // Já carregou este projeto: não remonta o form nem sobrescreve colagens em andamento
    // quando o Supabase renova o token ao voltar de outra aba.
    if (!isFirstLoadForId) return;

    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const row = await fetchProjeto(id);
        if (cancelled) return;
        setProjeto(row);
        setTitulo(row.titulo || "");
        setStatus(row.status || "rascunho");
        setPublico(row.publico_alvo || "ambos");
        const c = normalizeProjetoConteudo(row.conteudo);
        setConteudo(c);
        setKeywords((c.palavras_chave || []).join(", "));
        setAbrangencia(row.abrangencia_ufs || []);
        abrangenciaDirtyRef.current = false;
        dirtyRef.current = false;
        loadedIdRef.current = id;
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Erro ao carregar projeto");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoading, id]);

  // Avisa se sair da página com alterações não salvas
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const patchConteudo = <K extends keyof ProjetoConteudo>(key: K, value: ProjetoConteudo[K]) => {
    markDirty();
    setConteudo((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!id || !titulo.trim()) {
      toast.error("Título obrigatório");
      return;
    }
    setSaving(true);
    try {
      const next: ProjetoConteudo = {
        ...conteudo,
        palavras_chave: keywords
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const resumo =
        next.resumo_executivo?.trim() ||
        next.caracterizacao_problema?.trim()?.slice(0, 400) ||
        null;
      const objetivos = next.objetivo_geral?.trim() || null;
      const row = await updateProjeto(id, {
        titulo: titulo.trim(),
        status,
        publico_alvo: publico,
        resumo,
        objetivos,
        conteudo: next,
        ...(abrangenciaDirtyRef.current ? { abrangencia_ufs: abrangencia.length ? abrangencia : null } : {}),
      });
      setProjeto(row);
      abrangenciaDirtyRef.current = false;
      setConteudo(normalizeProjetoConteudo(row.conteudo));
      dirtyRef.current = false;
      toast.success("Projeto salvo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const runMatch = async () => {
    if (!id) return;
    // Salva antes de buscar para o score usar o texto atual
    await handleSave();
    setLocation(`/projetos/${id}/editais`);
  };

  const handleCandidatar = async (editalId: string, editalTitulo?: string) => {
    if (!user || !projeto) return;
    if (!canUsePropostas) {
      toast.error(subscriptionUpgradeMessage("propostas"));
      setLocation("/planos");
      return;
    }
    setCandidatandoEditalId(editalId);
    setCandidatandoLabel(editalTitulo || "edital selecionado");
    setAdaptProgress({ current: 0, total: 0, field: "Preparando…" });
    const toastId = `gerar-proposta-${editalId}`;
    toast.loading("Adaptando seções do projeto ao edital com IA…", { id: toastId });
    try {
      await handleSave();
      // Sempre regenera com IA (force) — evita abrir rascunho estrutural quase vazio
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
      setCandidatandoLabel("");
      setAdaptProgress(null);
    }
  };

  // Entrada a partir de /meus-projetos?candidatar=editalId
  useEffect(() => {
    if (loading || !projeto || !user || autoCandidatarDone.current) return;
    const editalId = new URLSearchParams(window.location.search).get("candidatar")?.trim();
    if (!editalId) return;
    autoCandidatarDone.current = true;
    window.history.replaceState({}, "", `/projetos/${id}`);
    void handleCandidatar(editalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara uma vez após carregar o projeto
  }, [loading, projeto?.id, user?.id, id]);

  return (
    <div className="min-h-screen flex flex-col bg-[color:var(--background)]">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 pb-28 sm:pb-24">
        <Link href="/meus-projetos">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Meus projetos
          </Button>
        </Link>

        {loading || !projeto ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="mb-6 rounded-md border border-border bg-white p-6">
              <p className="institutional-kicker mb-2">Documento do projeto</p>
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Texto completo</h1>
              <p className="mt-2 text-sm text-gray-600">
                Campos numerados 1–12 seguem a estrutura da chamada CNPq DT. Cole cada resposta no
                campo correspondente e use <strong>Salvar texto</strong> antes de sair. O formulário
                não recarrega mais ao alternar abas do navegador enquanto você copia do PDF.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="titulo">Título (português)</Label>
                  <Input
                    id="titulo"
                    value={titulo}
                    onChange={(e) => {
                      markDirty();
                      setTitulo(e.target.value);
                    }}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="titulo-en">Título (inglês)</Label>
                  <Input
                    id="titulo-en"
                    value={conteudo.titulo_ingles || ""}
                    onChange={(e) => patchConteudo("titulo_ingles", e.target.value)}
                    placeholder="Project title in English"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    className="w-full rounded-md border border-border px-3 py-2 text-sm"
                    value={status}
                    onChange={(e) => {
                      markDirty();
                      setStatus(e.target.value as ProjetoStatus);
                    }}
                  >
                    <option value="rascunho">Rascunho</option>
                    <option value="ativo">Ativo</option>
                    <option value="arquivado">Arquivado</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Público-alvo</Label>
                  <select
                    className="w-full rounded-md border border-border px-3 py-2 text-sm"
                    value={publico}
                    onChange={(e) => {
                      markDirty();
                      setPublico(e.target.value as ProjetoPublicoAlvo);
                    }}
                  >
                    <option value="pesquisador">Pesquisador</option>
                    <option value="empresa">Empresa</option>
                    <option value="ambos">Ambos</option>
                  </select>
                </div>
                <ProjetoAbrangenciaField
                  value={abrangencia}
                  onChange={(ufs) => {
                    markDirty();
                    abrangenciaDirtyRef.current = true;
                    setAbrangencia(ufs);
                  }}
                />
                <div className="space-y-2">
                  <Label htmlFor="inicio">Início previsto</Label>
                  <Input
                    id="inicio"
                    placeholder="Ex.: 01/08/2026"
                    value={conteudo.inicio_previsto || ""}
                    onChange={(e) => patchConteudo("inicio_previsto", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duracao">Duração (meses)</Label>
                  <Input
                    id="duracao"
                    placeholder="Ex.: 36"
                    value={conteudo.duracao_meses || ""}
                    onChange={(e) => patchConteudo("duracao_meses", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Origem do material</Label>
                  <select
                    className="w-full rounded-md border border-border px-3 py-2 text-sm"
                    value={conteudo.origem?.tipo || ""}
                    onChange={(e) => {
                      markDirty();
                      setConteudo((prev) => ({
                        ...prev,
                        origem: {
                          ...(prev.origem || {}),
                          tipo: (e.target.value || null) as ProjetoOrigemTipo | null,
                        },
                      }));
                    }}
                  >
                    <option value="">Não informado</option>
                    {(Object.keys(PROJETO_ORIGEM_LABELS) as ProjetoOrigemTipo[]).map((k) => (
                      <option key={k} value={k}>
                        {PROJETO_ORIGEM_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="origem-desc">Detalhe da origem</Label>
                  <Input
                    id="origem-desc"
                    placeholder="Ex.: submetido ao edital CNPq 2025"
                    value={conteudo.origem?.descricao || ""}
                    onChange={(e) => {
                      markDirty();
                      setConteudo((prev) => ({
                        ...prev,
                        origem: { ...(prev.origem || {}), descricao: e.target.value },
                      }));
                    }}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="keywords">Palavras-chave em português (vírgula)</Label>
                  <Input
                    id="keywords"
                    value={keywords}
                    onChange={(e) => {
                      markDirty();
                      setKeywords(e.target.value);
                    }}
                    placeholder="Recursos Hídricos; Sistema de Informações Hidrológico"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="keywords-en">Palavras-chave em inglês (vírgula)</Label>
                  <Input
                    id="keywords-en"
                    value={(conteudo.palavras_chave_ingles || []).join(", ")}
                    onChange={(e) =>
                      patchConteudo(
                        "palavras_chave_ingles",
                        e.target.value
                          .split(/[,;]/)
                          .map((s) => s.trim())
                          .filter(Boolean),
                      )
                    }
                    placeholder="Water Resources; Climate Change Impacts"
                  />
                </div>
              </div>

              <div className="mt-8 space-y-10">
                {(() => {
                  const groups: Array<{ name: string; sections: typeof PROJETO_SECTIONS }> = [];
                  for (const section of PROJETO_SECTIONS) {
                    const name = section.group || "Conteúdo";
                    const last = groups[groups.length - 1];
                    if (last && last.name === name) last.sections.push(section);
                    else groups.push({ name, sections: [section] });
                  }
                  return groups.map((g) => (
                    <div key={g.name} className="space-y-6">
                      <p className="institutional-kicker border-b border-border pb-2">{g.name}</p>
                      {g.sections.map((section) => (
                        <TextFieldWithAI
                          key={section.key}
                          id={`projeto-${section.key}`}
                          label={section.label}
                          value={String(conteudo[section.key] ?? "")}
                          onChange={(value) => patchConteudo(section.key, value as never)}
                          rows={section.rows || 5}
                          charLimit={section.charLimit}
                          showDescription
                          fieldDescription={section.hint}
                          projetoId={id}
                          allFormData={formContext}
                          placeholder={section.hint}
                        />
                      ))}
                    </div>
                  ));
                })()}
              </div>
            </div>
          </>
        )}
      </main>

      {!loading && projeto ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4">
          <div className="pointer-events-auto mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2 rounded-lg border border-border bg-white/95 px-3 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/90 sm:gap-3 sm:px-4">
            <Button type="button" onClick={() => void handleSave()} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar texto
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void runMatch()}
              disabled={saving}
              className="gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar editais compatíveis
            </Button>
            <Link href={`/dashboard?projeto=${encodeURIComponent(id)}`}>
              <Button type="button" variant="outline" disabled={saving}>
                Filtrar no painel
              </Button>
            </Link>
          </div>
        </div>
      ) : null}

      {candidatandoEditalId ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="adapt-proposta-title"
          aria-describedby="adapt-proposta-desc"
        >
          <div className="w-full max-w-md rounded-md border border-border bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center gap-3">
              <Loader2 className="h-8 w-8 shrink-0 animate-spin text-primary" />
              <div className="min-w-0">
                <h2 id="adapt-proposta-title" className="text-lg font-semibold text-gray-900">
                  Escrevendo a proposta…
                </h2>
                <p className="truncate text-sm text-gray-600">{candidatandoLabel}</p>
              </div>
            </div>

            <div className="mb-3">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">
                  {adaptProgress && adaptProgress.total > 0
                    ? `${Math.max(adaptProgress.current, 0)} de ${adaptProgress.total}`
                    : "Preparando…"}
                </p>
                {adaptProgress && adaptProgress.total > 0 ? (
                  <p className="text-xs text-gray-500">
                    {Math.round(
                      (Math.max(adaptProgress.current, 0) / adaptProgress.total) * 100,
                    )}
                    %
                  </p>
                ) : null}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{
                    width:
                      adaptProgress && adaptProgress.total > 0
                        ? `${Math.min(
                            100,
                            (Math.max(adaptProgress.current, 0) / adaptProgress.total) * 100,
                          )}%`
                        : "8%",
                  }}
                />
              </div>
              <p id="adapt-proposta-desc" className="mt-2 text-sm text-gray-700">
                {adaptProgress?.field
                  ? `Escrevendo: ${adaptProgress.field}`
                  : "A IA está adaptando as seções do seu projeto a este edital."}
              </p>
            </div>

            <p className="text-xs text-gray-500">
              Não feche nem recarregue a página até terminar.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
