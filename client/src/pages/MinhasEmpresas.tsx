import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Building2, Loader2, Plus, Trash2 } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useActiveEmpresa } from "@/contexts/ActiveEmpresaProvider";
import {
  createEmpresa,
  deleteEmpresa,
  type Empresa,
} from "@/lib/empresasApi";

function formatCNPJ(value: string) {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 14) {
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return value;
}

export default function MinhasEmpresas() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const { setActiveEmpresa, refreshEmpresas } = useActiveEmpresa();
  const [, setLocation] = useLocation();
  const [rows, setRows] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [razao, setRazao] = useState("");
  const [fantasia, setFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user) {
      setLocation("/login?redirect=/minhas-empresas");
      return;
    }
    if (profile && profile.userType !== "consultor") {
      toast.error("Apenas consultores gerenciam empresas");
      setLocation("/dashboard");
    }
  }, [user, authLoading, profile, profileLoading, setLocation]);

  const load = async () => {
    setLoading(true);
    try {
      const list = await refreshEmpresas();
      setRows(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar empresas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && profile?.userType === "consultor") void load();
  }, [user, profile?.userType]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!razao.trim()) {
      toast.error("Razão social obrigatória");
      return;
    }
    setSaving(true);
    try {
      const row = await createEmpresa({
        razao_social: razao.trim(),
        nome_fantasia: fantasia.trim() || null,
        cnpj: cnpj.replace(/\D/g, "") || null,
        area: profile?.area || null,
      });
      setActiveEmpresa(row.id);
      setRazao("");
      setFantasia("");
      setCnpj("");
      toast.success("Empresa cadastrada");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar empresa");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta empresa?")) return;
    try {
      await deleteEmpresa(id);
      toast.success("Empresa excluída");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir");
    }
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
          <p className="institutional-kicker mb-2">Consultor</p>
          <h1 className="text-3xl font-bold text-gray-900">Minhas empresas</h1>
          <p className="mt-2 text-sm text-gray-600">
            Cada empresa é um workspace próprio: dados, editais, projetos e propostas ficam filtrados pelo contexto ativo.
          </p>
        </div>

        <form onSubmit={handleCreate} className="mb-8 space-y-4 rounded-md border border-border bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">Nova empresa</h2>
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
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </Button>
        </form>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-600">Nenhuma empresa cadastrada ainda.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-4 rounded-md border border-border bg-white p-4">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-gray-900">{e.razao_social}</h3>
                  </div>
                  {e.nome_fantasia && <p className="text-sm text-gray-600">{e.nome_fantasia}</p>}
                  {e.cnpj && <p className="font-mono text-xs text-gray-500">{formatCNPJ(e.cnpj)}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActiveEmpresa(e.id);
                        toast.success("Empresa ativa no workspace");
                      }}
                    >
                      Usar no workspace
                    </Button>
                    <Link href={`/empresas/${e.id}`}>
                      <Button type="button" size="sm">
                        Abrir / editar
                      </Button>
                    </Link>
                    <Link href={`/meus-projetos?empresa_id=${e.id}`}>
                      <Button type="button" size="sm" variant="secondary">
                        Projetos
                      </Button>
                    </Link>
                    <Link href={`/minhas-propostas?empresa_id=${e.id}`}>
                      <Button type="button" size="sm" variant="secondary">
                        Propostas
                      </Button>
                    </Link>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => void handleDelete(e.id)}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
