import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, Sparkles, User } from "lucide-react";
import { useLocation, Link } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { fetchEditaisStatsForOnboarding } from "@/lib/editaisApi";
import { formatBRLCompact } from "@/lib/editalValorStats";
import { saveCurriculumToMetadata, setOnboardingCompleted, updateProfileFromOnboarding, type CurriculumData } from "@/lib/userProfile";
import { createEmpresa, fetchEmpresas } from "@/lib/empresasApi";
import Header from "@/components/Header";
import { Spinner } from "@/components/ui/spinner";
import AcademicFormationForm from "@/components/AcademicFormationForm";
import CnpqAreasAtuacaoForm from "@/components/CnpqAreasAtuacaoForm";
import { cnpqAreasToLabels, formatCnpqAreaAtuacao, type CnpqAreaAtuacao } from "@/lib/cnpqAreasConhecimento";

type StepCompletarPerfil = "telefone" | "curriculo" | "areasCnpq" | "area" | "concluido";
type StepConhecerEditais = "userType" | "area" | "result";

interface OnboardingData {
  telefone: string;
  userType: string;
  area: string;
  cnpj: string;
}

function formatTelefone(v: string): string {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 2) return n ? `(${n}` : "";
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
}

export default function Onboarding() {
  const [location, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useUserProfile();
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const isNewSignup = params.get("new") === "1";

  // Quem já concluiu o onboarding não fica nesta página: vai para o dashboard
  useEffect(() => {
    if (authLoading || profileLoading || !user) return;
    if (profile?.onboardingCompleted === true) {
      setLocation("/dashboard");
    }
  }, [user, authLoading, profileLoading, profile?.onboardingCompleted, setLocation]);

  const isOnboarding1 = Boolean(user && isNewSignup);

  /** Tipo de onboarding conforme perfil (pesquisador | consultor). */
  const onboardingVariant = profile?.userType === "consultor" ? "consultor" : "pesquisador";

  const [stepCompletar, setStepCompletar] = useState<StepCompletarPerfil>("telefone");
  const [stepConhecer, setStepConhecer] = useState<StepConhecerEditais>("userType");
  const [data, setData] = useState<OnboardingData>({ telefone: "", userType: "", area: "", cnpj: "" });
  const [loading, setLoading] = useState(false);
  const [savingFormacao, setSavingFormacao] = useState(false);
  const [savingAreasCnpq, setSavingAreasCnpq] = useState(false);
  const [formacaoFormKey, setFormacaoFormKey] = useState(0);
  const [areasCnpqFormKey, setAreasCnpqFormKey] = useState(0);
  const [editaisStats, setEditaisStats] = useState<{
    total: number;
    naArea: number;
    valorTotal: number;
    prazoMedioDias: number;
  } | null>(null);
  const [curriculumExtracted, setCurriculumExtracted] = useState(false);
  const [editingFormacao, setEditingFormacao] = useState(false);
  const [areasCnpqSaved, setAreasCnpqSaved] = useState(false);
  const [editingAreasCnpq, setEditingAreasCnpq] = useState(false);

  useEffect(() => {
    if (isNewSignup && user) {
      toast.success("Conta criada! Complete seu perfil para melhores recomendações.");
    }
  }, [isNewSignup, user]);

  const persistOnboardingAndGoToDashboard = async (opts?: { userType?: string; markCompleted?: boolean }) => {
    if (!user) {
      setLocation("/cadastro");
      toast.success("Crie sua conta para explorar seus editais!");
      return;
    }
    try {
      await updateProfileFromOnboarding(user.id, {
        phone: data.telefone.trim() || undefined,
        area: data.area || undefined,
        cnpj: data.cnpj.trim() ? data.cnpj : undefined,
        hasCnpj: data.cnpj.replace(/\D/g, "").length === 14,
        userType: opts?.userType
          ? (opts.userType === "consultor" || opts.userType === "pessoa-empresa" || opts.userType === "ambos"
              ? "consultor"
              : "pesquisador")
          : undefined,
        markOnboardingCompleted: opts?.markCompleted !== false,
      });

      // Consultor com CNPJ: cria primeira empresa se ainda não houver
      const cnpjDigits = data.cnpj.replace(/\D/g, "");
      if ((profile?.userType === "consultor" || opts?.userType === "consultor") && cnpjDigits.length === 14) {
        try {
          const existing = await fetchEmpresas();
          if (!existing.some((e) => String(e.cnpj || "").replace(/\D/g, "") === cnpjDigits)) {
            await createEmpresa({
              razao_social: `Empresa ${cnpjDigits.slice(-4)}`,
              cnpj: cnpjDigits,
              area: data.area || profile?.area || null,
            });
          }
        } catch (empresaErr) {
          console.warn("Empresa inicial não criada:", empresaErr);
        }
      }
    } catch (firstError) {
      try {
        await setOnboardingCompleted(user.id);
      } catch {
        throw firstError;
      }
    }
    await refetchProfile();
    setLocation("/dashboard");
    toast.success("Bem-vindo ao Origem.Lab!");
  };

  const handleSalvarPerfil = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await persistOnboardingAndGoToDashboard({ markCompleted: true });
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const hasCurriculum =
    !editingFormacao &&
    (curriculumExtracted ||
      Boolean(profile?.curriculumData && typeof profile.curriculumData === "object" &&
        Array.isArray(profile.curriculumData.formacao) &&
        profile.curriculumData.formacao.length > 0));

  const existingAreasCnpq = (profile?.curriculumData?.areasAtuacaoCnpq || []) as CnpqAreaAtuacao[];
  const hasAreasCnpq =
    !editingAreasCnpq &&
    (areasCnpqSaved || existingAreasCnpq.length > 0);

  const handleSaveFormacao = async (curriculumData: CurriculumData) => {
    if (!user) return;
    setSavingFormacao(true);
    try {
      await saveCurriculumToMetadata(curriculumData, user.id);
      setCurriculumExtracted(true);
      setEditingFormacao(false);
      toast.success("Formação acadêmica salva.");
      await refetchProfile();
      setStepCompletar("areasCnpq");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar formação. Tente novamente.";
      toast.error(msg);
      throw err;
    } finally {
      setSavingFormacao(false);
    }
  };

  const handleSaveAreasCnpq = async (areas: CnpqAreaAtuacao[]) => {
    if (!user) return;
    setSavingAreasCnpq(true);
    try {
      const prev = (profile?.curriculumData && typeof profile.curriculumData === "object"
        ? profile.curriculumData
        : {}) as CurriculumData;
      const next: CurriculumData = {
        ...prev,
        areasAtuacaoCnpq: areas,
        areasAtuacao: cnpqAreasToLabels(areas),
      };
      await saveCurriculumToMetadata(next, user.id);
      setAreasCnpqSaved(true);
      setEditingAreasCnpq(false);
      toast.success("Áreas de atuação salvas.");
      await refetchProfile();
      setStepCompletar("area");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar áreas. Tente novamente.";
      toast.error(msg);
      throw err;
    } finally {
      setSavingAreasCnpq(false);
    }
  };

  const handleUserTypeSelect = (type: string) => {
    setData((d) => ({ ...d, userType: type }));
    setStepConhecer("area");
  };

  const handleAreaSelectConhecer = async (area: string) => {
    setData((d) => ({ ...d, area }));
    setStepConhecer("result");
    setLoading(true);
    try {
      const stats = await fetchEditaisStatsForOnboarding(area || undefined);
      setEditaisStats(stats);
    } catch {
      setEditaisStats({ total: 0, naArea: 0, valorTotal: 0, prazoMedioDias: 30 });
    } finally {
      setLoading(false);
    }
  };

  const handleIrAoPainel = async () => {
    if (!user) {
      setLocation("/cadastro");
      toast.success("Crie sua conta para explorar seus editais!");
      return;
    }
    setLoading(true);
    try {
      await persistOnboardingAndGoToDashboard({
        userType: data.userType || undefined,
        markCompleted: true,
      });
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Quem já concluiu: mostrar loading até o redirect para o dashboard (evita flash do onboarding)
  if (user && (authLoading || profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isOnboarding1) {
    const steps: StepCompletarPerfil[] =
      onboardingVariant === "pesquisador"
        ? ["telefone", "curriculo", "areasCnpq", "area", "concluido"]
        : ["telefone", "curriculo", "area", "concluido"];
    const idx = Math.max(0, steps.indexOf(stepCompletar));
    const progress = ((idx + 1) / steps.length) * 100;

    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 bg-[color:var(--background)] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Complete seu perfil</h1>
              <p className="text-gray-600">Informações opcionais para recomendações melhores.</p>
              <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <Badge className="mt-2 bg-secondary text-primary border-border">Passo {idx + 1} de {steps.length}</Badge>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 space-y-6">
              {stepCompletar === "telefone" && (
                <>
                  <p className="text-gray-600">Telefone (opcional) para contato sobre editais.</p>
                  <Input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={data.telefone}
                    onChange={(e) => setData((d) => ({ ...d, telefone: formatTelefone(e.target.value) }))}
                    className="h-12 text-lg"
                  />
                  <Button className="w-full" onClick={() => setStepCompletar("curriculo")}>
                    Continuar <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </>
              )}

              {stepCompletar === "curriculo" && onboardingVariant === "consultor" && (
                <>
                  <p className="text-gray-600 mb-4">
                    Informe o CNPJ da primeira empresa (opcional). Você poderá cadastrar e gerenciar várias empresas depois em Minhas empresas.
                  </p>
                  <Input
                    placeholder="00.000.000/0001-00"
                    value={data.cnpj}
                    onChange={(e) => {
                      const n = e.target.value.replace(/\D/g, "").slice(0, 14);
                      let formatted = n;
                      if (n.length > 12) formatted = n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d+)/, "$1.$2.$3/$4-$5");
                      else if (n.length > 8) formatted = n.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, "$1.$2.$3/$4");
                      else if (n.length > 5) formatted = n.replace(/(\d{2})(\d{3})(\d+)/, "$1.$2.$3");
                      else if (n.length > 2) formatted = n.replace(/(\d{2})(\d+)/, "$1.$2");
                      setData((d) => ({ ...d, cnpj: formatted }));
                    }}
                    maxLength={18}
                    className="font-mono"
                  />
                  <Button className="w-full mt-3" onClick={() => setStepCompletar("area")}>
                    Continuar <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </>
              )}


              {stepCompletar === "curriculo" && onboardingVariant === "pesquisador" && (
                <>
                  <p className="text-gray-600 mb-4">
                    Informe sua formação acadêmica para análise de elegibilidade e match com editais.
                  </p>
                  {hasCurriculum ? (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg flex-1 min-w-0">
                          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                          <span className="text-sm font-medium text-green-800">Formação acadêmica cadastrada</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => {
                            setEditingFormacao(true);
                            setFormacaoFormKey((k) => k + 1);
                          }}
                        >
                          Editar
                        </Button>
                      </div>
                      <Button className="w-full" onClick={() => setStepCompletar("areasCnpq")}>
                        Continuar <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </div>
                  ) : (
                    <AcademicFormationForm
                      key={formacaoFormKey}
                      existing={profile?.curriculumData}
                      saving={savingFormacao}
                      onComplete={handleSaveFormacao}
                    />
                  )}
                </>
              )}

              {stepCompletar === "areasCnpq" && onboardingVariant === "pesquisador" && (
                <>
                  {hasAreasCnpq ? (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg flex-1 min-w-0">
                          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                          <span className="text-sm font-medium text-green-800">Áreas de atuação cadastradas</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => {
                            setEditingAreasCnpq(true);
                            setAreasCnpqFormKey((k) => k + 1);
                          }}
                        >
                          Editar
                        </Button>
                      </div>
                      {existingAreasCnpq.length > 0 && (
                        <ul className="text-sm text-gray-700 space-y-1 border border-border rounded-sm p-3 bg-secondary/30">
                          {existingAreasCnpq.map((a, i) => (
                            <li key={i}>
                              {a.custom ? (
                                <>
                                  <span className="text-xs font-medium text-primary mr-1.5">Outra</span>
                                  {formatCnpqAreaAtuacao(a)}
                                </>
                              ) : (
                                formatCnpqAreaAtuacao(a)
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      <Button className="w-full" onClick={() => setStepCompletar("area")}>
                        Continuar <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </div>
                  ) : (
                    <CnpqAreasAtuacaoForm
                      key={areasCnpqFormKey}
                      initial={existingAreasCnpq}
                      saving={savingAreasCnpq}
                      onComplete={handleSaveAreasCnpq}
                    />
                  )}
                </>
              )}

              {stepCompletar === "area" && (
                <>
                  <p className="text-gray-600">Sua principal área de atuação (opcional).</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "tech", label: "Tecnologia" },
                      { id: "health", label: "Saúde" },
                      { id: "agro", label: "Agronegócio" },
                      { id: "energy", label: "Energia" },
                      { id: "bio", label: "Biotecnologia" },
                      { id: "other", label: "Outra" },
                    ].map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setData((d) => ({ ...d, area: a.id }))}
                        className={`p-4 border rounded-sm text-left font-medium transition-colors ${data.area === a.id ? "border-primary bg-secondary text-primary" : "border-gray-200 hover:border-primary"}`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                  <Button className="w-full" onClick={() => setStepCompletar("concluido")}>
                    Continuar <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </>
              )}

              {stepCompletar === "concluido" && (
                <>
                  <div className="flex justify-center">
                    <CheckCircle2 className="w-16 h-16 text-primary" />
                  </div>
                  <p className="text-center text-gray-700">Tudo certo! Você pode completar mais dados depois na página de perfil.</p>
                  <p className="text-center text-sm text-gray-600">
                    Seu <strong>plano gratuito</strong> já está ativo — explore editais e use o painel sem pagar nada.
                    Quando quiser mais recursos (Pro ou Empresas), abra <strong>Planos</strong> no menu.
                  </p>
                  <Link href="/planos">
                    <Button type="button" variant="outline" className="w-full border-border text-primary hover:bg-secondary">
                      Conhecer planos pagos (opcional)
                    </Button>
                  </Link>
                  <Button className="w-full bg-primary hover:bg-primary/90" onClick={handleSalvarPerfil} disabled={loading}>
                    {loading ? "Salvando..." : "Ir ao painel"}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </>
              )}
            </div>

            <p className="text-center mt-6">
              <button
                type="button"
                onClick={() => void persistOnboardingAndGoToDashboard({ markCompleted: true })}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Pular e ir ao painel
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const stepsVisitante: StepConhecerEditais[] = ["userType", "area", "result"];
  const idxVisitante = stepsVisitante.indexOf(stepConhecer);
  const progressVisitante = ((idxVisitante + 1) / stepsVisitante.length) * 100;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 bg-[color:var(--background)] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              {stepConhecer === "userType" && "O que você busca?"}
              {stepConhecer === "area" && "Qual sua área de atuação?"}
              {stepConhecer === "result" && "Editais para você"}
            </h1>
            <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressVisitante}%` }} />
            </div>
            <Badge className="mt-2 bg-secondary text-primary border-border">Passo {idxVisitante + 1} de {stepsVisitante.length}</Badge>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
            {stepConhecer === "userType" && (
              <div className="space-y-6">
                <p className="text-gray-600">Selecione o perfil que mais combina com você.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: "startup", label: "Startup", desc: "Empresa inovadora" },
                    { id: "researcher", label: "Pesquisador", desc: "Pesquisa acadêmica" },
                    { id: "pme", label: "PME", desc: "Pequena/Média Empresa" },
                    { id: "institution", label: "Instituição", desc: "Universidade/Centro" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleUserTypeSelect(t.id)}
                      className={`p-4 border rounded-sm text-left transition-colors ${data.userType === t.id ? "border-primary bg-secondary text-primary" : "border-gray-200 hover:border-primary"}`}
                    >
                      <div className="font-semibold text-gray-900">{t.label}</div>
                      <div className="text-sm text-gray-600">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {stepConhecer === "area" && (
              <div className="space-y-6">
                <p className="text-gray-600">Qual sua principal área de atuação?</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "tech", label: "Tecnologia" },
                    { id: "health", label: "Saúde" },
                    { id: "agro", label: "Agronegócio" },
                    { id: "energy", label: "Energia" },
                    { id: "bio", label: "Biotecnologia" },
                    { id: "other", label: "Outra" },
                  ].map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleAreaSelectConhecer(a.id)}
                      className={`p-4 border rounded-sm font-medium transition-colors ${data.area === a.id ? "border-primary bg-secondary text-primary" : "border-gray-200 hover:border-primary"}`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {stepConhecer === "result" && (
              <div className="space-y-6 text-center">
                <div className="flex justify-center">
                  <CheckCircle2 className="w-20 h-20 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Encontramos <span className="text-primary">{editaisStats?.naArea ?? editaisStats?.total ?? "—"} editais</span> para você!
                </h2>
                <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-lg p-6 text-left">
                  <div>
                    <div className="text-2xl font-bold text-primary">{editaisStats?.naArea ?? editaisStats?.total ?? "—"}</div>
                    <div className="text-xs text-gray-600">Na sua área</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary">{editaisStats ? formatBRLCompact(editaisStats.valorTotal) : "—"}</div>
                    <div className="text-xs text-gray-600">Valor total</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary">{editaisStats?.prazoMedioDias ?? "—"} dias</div>
                    <div className="text-xs text-gray-600">Prazo médio</div>
                  </div>
                </div>
                <div className="text-left bg-blue-50 rounded-lg p-6 space-y-2">
                  <h3 className="font-semibold text-gray-900">Você pode ver:</h3>
                  <ul className="space-y-1 text-gray-700">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Editais completos e elegibilidade</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Indicações personalizadas no dashboard</li>
                    <li className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Upgrade Pro: todos os editais + IA Redatora</li>
                  </ul>
                </div>
                <Button size="lg" className="w-full bg-primary hover:bg-primary/90" onClick={handleIrAoPainel}>
                  {user ? "Explorar painel" : "Criar conta grátis"}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <p className="text-sm text-gray-600">
                  {user ? "Acesse seu painel para ver editais personalizados." : "Crie sua conta em menos de 2 minutos."}
                </p>
              </div>
            )}
          </div>

          {stepConhecer !== "result" && (
            <p className="text-center mt-6">
              <button type="button" onClick={() => setLocation(user ? "/dashboard" : "/cadastro")} className="text-sm text-gray-500 hover:text-gray-700 underline">
                {user ? "Pular para o painel" : "Já tenho conta"}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
