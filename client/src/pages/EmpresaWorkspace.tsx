import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useActiveEmpresa } from "@/contexts/ActiveEmpresaProvider";
import { fetchEmpresa, updateEmpresa, type Empresa } from "@/lib/empresasApi";

const AREA_OPTIONS = [
  { id: "tech", label: "Tecnologia" },
  { id: "health", label: "Saúde" },
  { id: "agro", label: "Agronegócio" },
  { id: "energy", label: "Energia" },
  { id: "bio", label: "Biotecnologia" },
  { id: "other", label: "Outra" },
] as const;

type EmpresaDados = {
  descricao?: string;
  porte?: string;
  cnae?: string;
  contato_nome?: string;
  contato_email?: string;
  contato_telefone?: string;
  endereco?: string;
  site?: string;
};

function formatCNPJ(value: string) {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 14) {
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return value;
}

function readDados(empresa: Empresa | null): EmpresaDados {
  const raw = empresa?.dados && typeof empresa.dados === "object" ? empresa.dados : {};
  return {
    descricao: typeof raw.descricao === "string" ? raw.descricao : "",
    porte: typeof raw.porte === "string" ? raw.porte : "",
    cnae: typeof raw.cnae === "string" ? raw.cnae : "",
    contato_nome: typeof raw.contato_nome === "string" ? raw.contato_nome : "",
    contato_email: typeof raw.contato_email === "string" ? raw.contato_email : "",
    contato_telefone: typeof raw.contato_telefone === "string" ? raw.contato_telefone : "",
    endereco: typeof raw.endereco === "string" ? raw.endereco : "",
    site: typeof raw.site === "string" ? raw.site : "",
  };
}

export default function EmpresaWorkspace() {
  const params = useParams<{ id: string }>();
  const id = String(params.id || "").trim();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const { setActiveEmpresa, refreshEmpresas } = useActiveEmpresa();
  const [, setLocation] = useLocation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [razao, setRazao] = useState("");
  const [fantasia, setFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [area, setArea] = useState("");
  const [dados, setDados] = useState<EmpresaDados>({});

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user) {
      setLocation(`/login?redirect=/empresas/${id}`);
      return;
    }
    if (profile && profile.userType !== "consultor") {
      toast.error("Apenas consultores acessam o workspace da empresa");
      setLocation("/dashboard");
    }
  }, [user, authLoading, profile, profileLoading, setLocation, id]);

  useEffect(() => {
    if (!user || profile?.userType !== "consultor" || !id) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const row = await fetchEmpresa(id);
        if (cancelled) return;
        setRazao(row.razao_social || "");
        setFantasia(row.nome_fantasia || "");
        setCnpj(row.cnpj ? formatCNPJ(row.cnpj) : "");
        setArea(row.area || "");
        setDados(readDados(row));
        setActiveEmpresa(row.id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Empresa não encontrada");
        setLocation("/minhas-empresas");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, profile?.userType, id, setActiveEmpresa, setLocation]);

  const title = useMemo(() => fantasia.trim() || razao.trim() || "Empresa", [fantasia, razao]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!razao.trim()) {
      toast.error("Razão social obrigatória");
      return;
    }
    setSaving(true);
    try {
      await updateEmpresa(id, {
        razao_social: razao.trim(),
        nome_fantasia: fantasia.trim() || null,
        cnpj: cnpj.replace(/\D/g, "") || null,
        area: area || null,
        dados: {
          descricao: dados.descricao?.trim() || "",
          porte: dados.porte?.trim() || "",
          cnae: dados.cnae?.trim() || "",
          contato_nome: dados.contato_nome?.trim() || "",
          contato_email: dados.contato_email?.trim() || "",
          contato_telefone: dados.contato_telefone?.replace(/\D/g, "") || "",
          endereco: dados.endereco?.trim() || "",
          site: dados.site?.trim() || "",
        },
      });
      await refreshEmpresas();
      toast.success("Dados da empresa salvos");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || profileLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[color:var(--background)]">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <Link href="/minhas-empresas">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Minhas empresas
          </Button>
        </Link>

        <div className="mb-8">
          <p className="institutional-kicker mb-2">Workspace</p>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900">
            <Building2 className="h-7 w-7 text-primary" />
            {title}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Perfil da empresa: dados, editais e projetos ficam organizados neste contexto.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard">
              <Button type="button" size="sm" variant="secondary">
                Editais desta empresa
              </Button>
            </Link>
            <Link href={`/meus-projetos?empresa_id=${id}`}>
              <Button type="button" size="sm" variant="outline">
                Projetos
              </Button>
            </Link>
            <Link href={`/minhas-propostas?empresa_id=${id}`}>
              <Button type="button" size="sm" variant="outline">
                Propostas
              </Button>
            </Link>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5 rounded-md border border-border bg-white p-6">
          <div className="space-y-2">
            <Label htmlFor="razao">Razão social</Label>
            <Input id="razao" value={razao} onChange={(e) => setRazao(e.target.value)} disabled={saving} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fantasia">Nome fantasia</Label>
              <Input id="fantasia" value={fantasia} onChange={(e) => setFantasia(e.target.value)} disabled={saving} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={cnpj}
                onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                disabled={saving}
                maxLength={18}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="area">Área</Label>
              <select
                id="area"
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                disabled={saving}
              >
                <option value="">Selecione</option>
                {AREA_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="porte">Porte</Label>
              <Input
                id="porte"
                value={dados.porte || ""}
                onChange={(e) => setDados((d) => ({ ...d, porte: e.target.value }))}
                disabled={saving}
                placeholder="ME, EPP, Médio…"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição / atuação</Label>
            <Textarea
              id="descricao"
              value={dados.descricao || ""}
              onChange={(e) => setDados((d) => ({ ...d, descricao: e.target.value }))}
              disabled={saving}
              rows={4}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cnae">CNAE</Label>
              <Input
                id="cnae"
                value={dados.cnae || ""}
                onChange={(e) => setDados((d) => ({ ...d, cnae: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site">Site</Label>
              <Input
                id="site"
                value={dados.site || ""}
                onChange={(e) => setDados((d) => ({ ...d, site: e.target.value }))}
                disabled={saving}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contato_nome">Contato (nome)</Label>
              <Input
                id="contato_nome"
                value={dados.contato_nome || ""}
                onChange={(e) => setDados((d) => ({ ...d, contato_nome: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contato_email">Contato (email)</Label>
              <Input
                id="contato_email"
                type="email"
                value={dados.contato_email || ""}
                onChange={(e) => setDados((d) => ({ ...d, contato_email: e.target.value }))}
                disabled={saving}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contato_telefone">Telefone</Label>
              <Input
                id="contato_telefone"
                value={dados.contato_telefone || ""}
                onChange={(e) => setDados((d) => ({ ...d, contato_telefone: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={dados.endereco || ""}
                onChange={(e) => setDados((d) => ({ ...d, endereco: e.target.value }))}
                disabled={saving}
              />
            </div>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar dados
          </Button>
        </form>
      </main>
    </div>
  );
}
