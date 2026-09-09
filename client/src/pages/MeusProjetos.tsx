import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  FolderKanban,
  Loader2,
  Plus,
  Search,
  Trash2,
  FileText,
} from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useActiveEmpresa } from "@/contexts/ActiveEmpresaProvider";
import { fetchEmpresas, type Empresa } from "@/lib/empresasApi";
import {
  createProjeto,
  createProjetoFromProposta,
  deleteProjeto,
  fetchProjetos,
  type Projeto,
  type ProjetoPublicoAlvo,
} from "@/lib/projetosApi";
import { fetchPropostas, type Proposta } from "@/lib/propostasApi";
import {
  createEmptyProjetoConteudo,
  PROJETO_ORIGEM_LABELS,
  type ProjetoOrigemTipo,
} from "@/lib/projetoFormFields";

const AREA_OPTIONS = [
  { id: "tech", label: "Tecnologia" },
  { id: "health", label: "Saúde" },
  { id: "agro", label: "Agronegócio" },
  { id: "energy", label: "Energia" },
  { id: "bio", label: "Biotecnologia" },
  { id: "other", label: "Outra" },
] as const;

export default function MeusProjetos() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const { activeEmpresaId, setActiveEmpresa } = useActiveEmpresa();
  const [location, setLocation] = useLocation();
  const empresaFilter = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const fromUrl = new URLSearchParams(window.location.search).get("empresa_id");
    if (fromUrl) return fromUrl;
    if (profile?.userType === "consultor") return activeEmpresaId || undefined;
    return undefined;
  }, [location, profile?.userType, activeEmpresaId]);

  const [rows, setRows] = useState<Projeto[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [area, setArea] = useState("");
  const [empresaId, setEmpresaId] = useState<string>("");
  const [publico, setPublico] = useState<ProjetoPublicoAlvo>("ambos");
  const [origemTipo, setOrigemTipo] = useState<ProjetoOrigemTipo>("projeto_pesquisa");
  const [origemDesc, setOrigemDesc] = useState("");
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [fromPropostaId, setFromPropostaId] = useState("");
  const [importing, setImporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Projeto | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user) setLocation("/login?redirect=/meus-projetos");
  }, [user, authLoading, profileLoading, setLocation]);

  useEffect(() => {
    if (profile?.userType === "pesquisador") setPublico("pesquisador");
    else if (profile?.userType === "consultor") setPublico("empresa");
  }, [profile?.userType]);

  useEffect(() => {
    if (empresaFilter) {
      setEmpresaId(empresaFilter);
      setActiveEmpresa(empresaFilter);
    }
  }, [empresaFilter, setActiveEmpresa]);

  const load = async () => {
    setLoading(true);
    try {
      const [projetos, emps, props] = await Promise.all([
        fetchProjetos(empresaFilter),
        profile?.userType === "consultor" ? fetchEmpresas() : Promise.resolve([] as Empresa[]),
        user
          ? fetchPropostas(user.id, empresaFilter).catch(() => [] as Proposta[])
          : Promise.resolve([] as Proposta[]),
      ]);
      setRows(projetos);
      setEmpresas(emps);
      setPropostas(props);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar projetos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && profile) void load();
  }, [user, profile?.userType, empresaFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      toast.error("Título obrigatório");
      return;
    }
    if (profile?.userType === "consultor" && !empresaId) {
      toast.error("Selecione a empresa do projeto");
      return;
    }
    setSaving(true);
    try {
      const conteudo = createEmptyProjetoConteudo();
      conteudo.origem = {
        tipo: origemTipo,
        descricao: origemDesc.trim(),
        ano: "",
      };
      const row = await createProjeto({
        titulo: titulo.trim(),
        resumo: null,
        objetivos: null,
        area: area || profile?.area || null,
        publico_alvo: publico,
        status: "rascunho",
        empresa_id: profile?.userType === "consultor" ? empresaId || null : null,
        conteudo,
      });
      if (profile?.userType === "consultor" && empresaId) setActiveEmpresa(empresaId);
      toast.success("Projeto criado — complete o texto escrito");
      setTitulo("");
      setOrigemDesc("");
      setLocation(`/projetos/${row.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar projeto");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProjeto(deleteTarget.id);
      toast.success("Projeto excluído");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir");
    } finally {
      setDeleting(false);
    }
  };

  const handleImportFromProposta = async () => {
    if (!fromPropostaId) {
      toast.error("Escolha uma proposta");
      return;
    }
    const proposta = propostas.find((p) => p.id === fromPropostaId);
    if (!proposta) {
      toast.error("Proposta não encontrada");
      return;
    }
    setImporting(true);
    try {
      const row = await createProjetoFromProposta(proposta, {
        area: area || profile?.area || null,
        publico_alvo: publico,
        empresa_id: profile?.userType === "consultor" ? empresaId || null : null,
      });
      toast.success("Projeto criado a partir da proposta");
      setFromPropostaId("");
      setLocation(`/projetos/${row.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar");
    } finally {
      setImporting(false);
    }
  };

  const empresaNome = (id?: string | null) => {
    if (!id) return null;
    return empresas.find((e) => e.id === id)?.razao_social || id;
  };

  const origemLabel = (p: Projeto) => {
    const tipo = (p.conteudo as any)?.origem?.tipo as ProjetoOrigemTipo | undefined;
    return tipo ? PROJETO_ORIGEM_LABELS[tipo] : null;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[color:var(--background)]">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <Link href="/dashboard">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>

        <div className="mb-8">
          <p className="institutional-kicker mb-2">Projetos</p>
          <h1 className="text-3xl font-bold text-gray-900">Meus projetos</h1>
          <p className="mt-2 text-sm text-gray-600">
            Um projeto é o texto completo que você já tem: proposta enviada a outro edital, linha de pesquisa
            ou material com o qual quer captar fomento. Use{" "}
            <span className="font-medium text-gray-800">Buscar editais</span> para abrir a tela de
            chamadas compatíveis, ou filtre pelo projeto no painel principal.
          </p>
        </div>

        <form onSubmit={handleCreate} className="mb-8 space-y-4 rounded-md border border-border bg-white p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Plus className="h-5 w-5" />
            Novo projeto
          </h2>
          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required disabled={saving} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Origem do material</Label>
              <select
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
                value={origemTipo}
                onChange={(e) => setOrigemTipo(e.target.value as ProjetoOrigemTipo)}
                disabled={saving}
              >
                {(Object.keys(PROJETO_ORIGEM_LABELS) as ProjetoOrigemTipo[]).map((k) => (
                  <option key={k} value={k}>
                    {PROJETO_ORIGEM_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="origem-desc">Detalhe da origem (opcional)</Label>
              <Input
                id="origem-desc"
                placeholder="Ex.: Edital FAPESP 12/2024"
                value={origemDesc}
                onChange={(e) => setOrigemDesc(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Área</Label>
              <select
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                disabled={saving}
              >
                <option value="">Usar área do perfil</option>
                {AREA_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Público-alvo</Label>
              <select
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
                value={publico}
                onChange={(e) => setPublico(e.target.value as ProjetoPublicoAlvo)}
                disabled={saving}
              >
                <option value="pesquisador">Pesquisador</option>
                <option value="empresa">Empresa</option>
                <option value="ambos">Ambos</option>
              </select>
            </div>
          </div>
          {profile?.userType === "consultor" && (
            <div className="space-y-2">
              <Label>Empresa (opcional)</Label>
              <select
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
                value={empresaId}
                onChange={(e) => setEmpresaId(e.target.value)}
                disabled={saving}
              >
                <option value="">Sem empresa</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.razao_social}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar e escrever o projeto
          </Button>
        </form>

        {propostas.length > 0 && (
          <div className="mb-8 space-y-3 rounded-md border border-dashed border-border bg-white p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <FileText className="h-5 w-5" />
              A partir de uma proposta já salva
            </h2>
            <p className="text-sm text-gray-600">
              Copia o texto da candidatura para um Projeto reutilizável — útil para buscar outros editais sem
              reescrever do zero.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <Label>Proposta</Label>
                <select
                  className="w-full rounded-md border border-border px-3 py-2 text-sm"
                  value={fromPropostaId}
                  onChange={(e) => setFromPropostaId(e.target.value)}
                  disabled={importing}
                >
                  <option value="">Selecione…</option>
                  {propostas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {(p.campos_formulario as any)?.titulo_projeto || p.edital_titulo || "Sem título"} —{" "}
                      {p.status}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={importing || !fromPropostaId}
                onClick={() => void handleImportFromProposta()}
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderKanban className="h-4 w-4" />}
                Criar projeto desta proposta
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-600">Nenhum projeto ainda.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-4 rounded-md border border-border bg-white p-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <FolderKanban className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-gray-900">{p.titulo}</h3>
                    <Badge variant="outline">{p.status}</Badge>
                    {origemLabel(p) && <Badge variant="secondary">{origemLabel(p)}</Badge>}
                  </div>
                  {(p.resumo || (p.conteudo as any)?.resumo_executivo) && (
                    <p className="line-clamp-2 text-sm text-gray-600">
                      {p.resumo || String((p.conteudo as any)?.resumo_executivo || "")}
                    </p>
                  )}
                  {p.empresa_id && (
                    <p className="mt-1 text-xs text-gray-500">Empresa: {empresaNome(p.empresa_id)}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/projetos/${p.id}/editais`}>
                      <Button type="button" size="sm">
                        <Search className="mr-1 h-3.5 w-3.5" />
                        Buscar editais
                      </Button>
                    </Link>
                    <Link href={`/dashboard?projeto=${encodeURIComponent(p.id)}`}>
                      <Button type="button" size="sm" variant="secondary">
                        Filtrar no painel
                      </Button>
                    </Link>
                    <Link href={`/projetos/${p.id}`}>
                      <Button size="sm" variant="outline">
                        <FolderKanban className="mr-1 h-3.5 w-3.5" />
                        Abrir / editar texto
                      </Button>
                    </Link>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteTarget(p)}
                  aria-label={`Excluir projeto ${p.titulo}`}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove permanentemente{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.titulo || "este projeto"}
              </span>
              . Propostas já criadas a partir dele não são apagadas automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo…
                </>
              ) : (
                "Excluir projeto"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
