import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, FileUp, Loader2, PenLine, Sparkles } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useActiveEmpresa } from "@/contexts/ActiveEmpresaProvider";
import { fetchEmpresas, type Empresa } from "@/lib/empresasApi";
import {
  createProjeto,
  extrairProjetoDePdf,
  gerarRascunhoProjeto,
  type ProjetoPublicoAlvo,
} from "@/lib/projetosApi";
import {
  createEmptyProjetoConteudo,
  PROJETO_ORIGEM_LABELS,
  type ProjetoConteudo,
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

const MAX_PDF_BYTES = 48 * 1024 * 1024;

type Modo = "pdf" | "ia" | "manual";

const MODOS: Array<{ id: Modo; titulo: string; descricao: string; icon: typeof FileUp }> = [
  {
    id: "pdf",
    titulo: "Enviar o projeto",
    descricao: "Tem o texto pronto em PDF? A IA lê o arquivo e preenche os campos para você revisar.",
    icon: FileUp,
  },
  {
    id: "ia",
    titulo: "Deixar a IA escrever",
    descricao: "Diga do que se trata e a IA redige um rascunho de todos os campos. Você revisa depois.",
    icon: Sparkles,
  },
  {
    id: "manual",
    titulo: "Escrever eu mesmo",
    descricao: "Crie o projeto vazio e escreva cada seção no seu ritmo.",
    icon: PenLine,
  },
];

const selectClass = "w-full rounded-md border border-border px-3 py-2 text-sm";

export default function NovoProjeto() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const { setActiveEmpresa } = useActiveEmpresa();
  const [, setLocation] = useLocation();

  const [modo, setModo] = useState<Modo | null>(null);
  const [busy, setBusy] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [area, setArea] = useState("");
  const [publico, setPublico] = useState<ProjetoPublicoAlvo>("ambos");
  const [origemTipo, setOrigemTipo] = useState<ProjetoOrigemTipo>("projeto_pesquisa");
  const [origemDesc, setOrigemDesc] = useState("");

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");

  const isConsultor = profile?.userType === "consultor";

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user) setLocation("/login?redirect=/projetos/novo");
  }, [user, authLoading, profileLoading, setLocation]);

  useEffect(() => {
    if (profile?.userType === "pesquisador") setPublico("pesquisador");
    else if (profile?.userType === "consultor") setPublico("empresa");
  }, [profile?.userType]);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("empresa_id");
    if (fromUrl) setEmpresaId(fromUrl);
  }, []);

  useEffect(() => {
    if (!user || !isConsultor) return;
    fetchEmpresas()
      .then(setEmpresas)
      .catch(() => setEmpresas([]));
  }, [user, isConsultor]);

  const empresaPayload = () => (isConsultor ? empresaId || null : null);

  const criarProjeto = async (input: {
    titulo: string;
    resumo?: string | null;
    area?: string | null;
    conteudo: ProjetoConteudo;
  }) => {
    if (isConsultor && empresaId) setActiveEmpresa(empresaId);
    const row = await createProjeto({
      titulo: input.titulo,
      resumo: input.resumo ?? null,
      objetivos: null,
      area: input.area || profile?.area || null,
      publico_alvo: publico,
      status: "rascunho",
      empresa_id: empresaPayload(),
      conteudo: input.conteudo,
    });
    return row;
  };

  const conteudoComOrigem = (base: ProjetoConteudo, descricaoOrigem: string): ProjetoConteudo => ({
    ...base,
    origem: { tipo: origemTipo, descricao: descricaoOrigem, ano: "" },
  });

  const handleEnviarPdf = async (e: FormEvent) => {
    e.preventDefault();
    if (!arquivo) {
      toast.error("Escolha o arquivo PDF do projeto");
      return;
    }
    if (arquivo.size > MAX_PDF_BYTES) {
      toast.error("PDF acima de 48 MB. Envie uma versão mais enxuta.");
      return;
    }
    if (isConsultor && !empresaId) {
      toast.error("Selecione a empresa do projeto");
      return;
    }
    setBusy(true);
    try {
      const extraido = await extrairProjetoDePdf(arquivo);
      const nomeArquivo = arquivo.name.replace(/\.pdf$/i, "");
      const row = await criarProjeto({
        titulo: extraido.titulo || nomeArquivo,
        resumo: extraido.resumo || null,
        area: extraido.area || null,
        conteudo: conteudoComOrigem(
          { ...createEmptyProjetoConteudo(), ...extraido.conteudo },
          origemDesc.trim() || `Importado de ${arquivo.name}`,
        ),
      });
      toast.success(`${extraido.campos_preenchidos} campos preenchidos — revise o texto`);
      setLocation(`/projetos/${row.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao extrair o projeto");
    } finally {
      setBusy(false);
    }
  };

  const handleIa = async (e: FormEvent) => {
    e.preventDefault();
    if (!descricao.trim() && !titulo.trim()) {
      toast.error("Descreva o projeto ou a ideia");
      return;
    }
    if (isConsultor && !empresaId) {
      toast.error("Selecione a empresa do projeto");
      return;
    }
    setBusy(true);
    try {
      const rascunho = await gerarRascunhoProjeto({
        titulo: titulo.trim(),
        area: area || null,
        origem_tipo: origemTipo,
        origem_descricao: origemDesc.trim() || null,
        descricao: descricao.trim(),
        publico_alvo: publico,
      });
      const tituloFinal = titulo.trim() || descricao.trim().slice(0, 120);
      const row = await criarProjeto({
        titulo: tituloFinal,
        resumo: null,
        area: area || null,
        conteudo: conteudoComOrigem(
          { ...createEmptyProjetoConteudo(), ...rascunho },
          origemDesc.trim(),
        ),
      });
      toast.success("Rascunho criado — revise os campos antes de usar");
      setLocation(`/projetos/${row.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar o rascunho");
    } finally {
      setBusy(false);
    }
  };

  const handleManual = async (e: FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      toast.error("Título obrigatório");
      return;
    }
    if (isConsultor && !empresaId) {
      toast.error("Selecione a empresa do projeto");
      return;
    }
    setBusy(true);
    try {
      const row = await criarProjeto({
        titulo: titulo.trim(),
        conteudo: conteudoComOrigem(createEmptyProjetoConteudo(), origemDesc.trim()),
        area,
      });
      toast.success("Projeto criado — complete o texto escrito");
      setLocation(`/projetos/${row.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar projeto");
    } finally {
      setBusy(false);
    }
  };

  const onArquivo = (e: ChangeEvent<HTMLInputElement>) => {
    setArquivo(e.target.files?.[0] ?? null);
  };

  const origemField = (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Origem do material</Label>
        <select
          className={selectClass}
          value={origemTipo}
          onChange={(e) => setOrigemTipo(e.target.value as ProjetoOrigemTipo)}
          disabled={busy}
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
          disabled={busy}
        />
      </div>
    </div>
  );

  const areaPublicoFields = (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Área</Label>
        <select className={selectClass} value={area} onChange={(e) => setArea(e.target.value)} disabled={busy}>
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
          className={selectClass}
          value={publico}
          onChange={(e) => setPublico(e.target.value as ProjetoPublicoAlvo)}
          disabled={busy}
        >
          <option value="pesquisador">Pesquisador</option>
          <option value="empresa">Empresa</option>
          <option value="ambos">Ambos</option>
        </select>
      </div>
    </div>
  );

  const empresaField = isConsultor ? (
    <div className="space-y-2">
      <Label>Empresa</Label>
      <select className={selectClass} value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} disabled={busy}>
        <option value="">Selecione…</option>
        {empresas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.razao_social}
          </option>
        ))}
      </select>
    </div>
  ) : null;

  const submitButton = (label: string, loadingLabel: string, icon: ReactNode) => (
    <Button type="submit" disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {busy ? loadingLabel : label}
    </Button>
  );

  const renderModo = () => {
    if (modo === "pdf") {
      return (
        <form onSubmit={handleEnviarPdf} className="space-y-5 rounded-md border border-border bg-white p-5">
          <div className="space-y-2">
            <Label htmlFor="arquivo-projeto">Arquivo do projeto (PDF)</Label>
            <Input
              id="arquivo-projeto"
              type="file"
              accept="application/pdf,.pdf"
              onChange={onArquivo}
              disabled={busy}
            />
            <p className="text-xs text-gray-500">
              {arquivo ? `${arquivo.name} — ${(arquivo.size / (1024 * 1024)).toFixed(1)} MB` : "Até 48 MB, com texto selecionável."}
            </p>
          </div>
          {origemField}
          {areaPublicoFields}
          {empresaField}
          <p className="text-sm text-gray-600">
            A IA identifica título, resumo, palavras-chave e as seções do texto. Campos que não estiverem no
            documento ficam vazios para você completar.
          </p>
          {submitButton(
            "Extrair campos com IA",
            "Lendo o PDF… pode levar até um minuto",
            <FileUp className="h-4 w-4" />,
          )}
        </form>
      );
    }

    if (modo === "ia") {
      return (
        <form onSubmit={handleIa} className="space-y-5 rounded-md border border-border bg-white p-5">
          <div className="space-y-2">
            <Label htmlFor="titulo-ia">Título (opcional)</Label>
            <Input id="titulo-ia" value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={busy} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao-ia">Do que se trata o projeto?</Label>
            <Textarea
              id="descricao-ia"
              rows={6}
              placeholder="Problema que quer resolver, público, tecnologia ou método, resultados que imagina. Quanto mais detalhe, melhor o rascunho."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              disabled={busy}
            />
          </div>
          {origemField}
          {areaPublicoFields}
          {empresaField}
          <p className="text-sm text-gray-600">
            A IA redige um rascunho de cada seção. Ela não inventa valores, nomes ou resultados: onde faltar
            informação, deixa um marcador entre colchetes para você preencher.
          </p>
          {submitButton("Gerar rascunho", "Escrevendo o rascunho… pode levar um minuto", <Sparkles className="h-4 w-4" />)}
        </form>
      );
    }

    if (modo === "manual") {
      return (
        <form onSubmit={handleManual} className="space-y-5 rounded-md border border-border bg-white p-5">
          <div className="space-y-2">
            <Label htmlFor="titulo-manual">Título</Label>
            <Input
              id="titulo-manual"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          {origemField}
          {areaPublicoFields}
          {empresaField}
          {submitButton("Criar e escrever o projeto", "Criando…", <PenLine className="h-4 w-4" />)}
        </form>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-3">
        {MODOS.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setModo(m.id)}
              className="flex flex-col items-start gap-3 rounded-md border border-border bg-white p-5 text-left transition hover:border-primary hover:shadow-sm"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="font-semibold text-gray-900">{m.titulo}</span>
              <span className="text-sm text-gray-600">{m.descricao}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const modoAtual = MODOS.find((m) => m.id === modo);

  return (
    <div className="min-h-screen flex flex-col bg-[color:var(--background)]">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {modo ? (
          <Button variant="ghost" className="mb-4" onClick={() => setModo(null)} disabled={busy}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Escolher outra forma
          </Button>
        ) : (
          <Link href="/meus-projetos">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Meus projetos
            </Button>
          </Link>
        )}

        <div className="mb-8">
          <p className="institutional-kicker mb-2">Novo projeto</p>
          <h1 className="text-3xl font-bold text-gray-900">
            {modoAtual ? modoAtual.titulo : "Como você quer começar?"}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {modoAtual
              ? "Revise tudo antes de usar o projeto em um edital."
              : "Escolha de onde vem o texto. Em todos os casos você revisa os campos antes de buscar editais."}
          </p>
        </div>

        {renderModo()}
      </main>
    </div>
  );
}
