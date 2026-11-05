import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { saveCurriculumToMetadata, type CurriculumData } from "@/lib/userProfile";
import { fetchCNPJData, fetchCPFData, LattesData, CNPJData, CPFData, formatCPF, formatCNPJ, formatCEP } from "@/lib/externalAPIs";
import Header from "@/components/Header";
import AcademicFormationForm from "@/components/AcademicFormationForm";
import CnpqAreasAtuacaoForm from "@/components/CnpqAreasAtuacaoForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { 
  User, 
  Mail, 
  FileText, 
  Building2, 
  GraduationCap, 
  MapPin, 
  Phone, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  Share2,
  RefreshCw,
  CreditCard,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { createBillingPortalSession, createCheckoutSession, syncSubscriptionFromStripe } from "@/lib/stripeBilling";
import { cnpqAreasToLabels, formatCnpqAreaAtuacao, type CnpqAreaAtuacao } from "@/lib/cnpqAreasConhecimento";

const AREA_LABELS: Record<string, string> = {
  tech: "Tecnologia",
  health: "Saúde",
  agro: "Agronegócio",
  energy: "Energia",
  bio: "Biotecnologia",
  other: "Outra",
};

function getAreaLabel(areaId: string | undefined): string {
  if (!areaId) return "—";
  return AREA_LABELS[areaId] ?? areaId;
}

function formatPhone(phone: string | undefined): string {
  if (!phone) return "";
  const n = phone.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 2) return n ? `(${n}` : "";
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
}

export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, refetch } = useUserProfile();
  const [lattesData, setLattesData] = useState<LattesData | null>(null);
  const [cnpjData, setCnpjData] = useState<CNPJData | null>(null);
  const [cpfData, setCpfData] = useState<CPFData | null>(null);
  const [loadingCNPJ, setLoadingCNPJ] = useState(false);
  const [loadingCPF, setLoadingCPF] = useState(false);
  const [savingFormacao, setSavingFormacao] = useState(false);
  const [editingFormacao, setEditingFormacao] = useState(false);
  const [formacaoFormKey, setFormacaoFormKey] = useState(0);
  const [savingAreasCnpq, setSavingAreasCnpq] = useState(false);
  const [editingAreasCnpq, setEditingAreasCnpq] = useState(false);
  const [areasCnpqFormKey, setAreasCnpqFormKey] = useState(0);
  const [portalLoading, setPortalLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<"pro" | "empresas" | null>(null);
  const hasRefetched = useRef(false);

  const loading = authLoading || profileLoading;

  const handleSaveFormacao = async (data: CurriculumData) => {
    setSavingFormacao(true);
    try {
      await saveCurriculumToMetadata(data, user?.id);
      setLattesData(data as LattesData);
      setEditingFormacao(false);
      await refetch();
      toast.success("Formação acadêmica salva.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar formação. Tente novamente.";
      toast.error(msg);
      throw err;
    } finally {
      setSavingFormacao(false);
    }
  };

  const handleSaveAreasCnpq = async (areas: CnpqAreaAtuacao[]) => {
    setSavingAreasCnpq(true);
    try {
      const prev = (profile?.curriculumData && typeof profile.curriculumData === "object"
        ? profile.curriculumData
        : lattesData || {}) as CurriculumData;
      const next: CurriculumData = {
        ...prev,
        areasAtuacaoCnpq: areas,
        areasAtuacao: cnpqAreasToLabels(areas),
      };
      await saveCurriculumToMetadata(next, user?.id);
      setLattesData(next as LattesData);
      setEditingAreasCnpq(false);
      await refetch();
      toast.success("Áreas de atuação salvas.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar áreas. Tente novamente.";
      toast.error(msg);
      throw err;
    } finally {
      setSavingAreasCnpq(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLocation("/login");
      return;
    }
    // Força nova leitura do perfil no banco ao abrir a página (dados sempre atualizados)
    if (!hasRefetched.current) {
      hasRefetched.current = true;
      refetch();
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      void (async () => {
        try {
          const out = await syncSubscriptionFromStripe();
          await refetch();
          toast.success(
            out.plan_key === "empresas"
              ? "Plano Empresas ativado!"
              : out.plan_key === "pro"
                ? "Plano Pro ativado!"
                : "Assinatura sincronizada!",
          );
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Erro ao sincronizar assinatura.");
        } finally {
          params.delete("checkout");
          const qs = params.toString();
          window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
        }
      })();
    }
  }, [user, authLoading, setLocation, refetch]);

  // Sincronizar currículo e disparar carregamento de CNPJ/CPF quando o perfil vier do banco
  useEffect(() => {
    if (!profile) return;
    if (profile.curriculumData && typeof profile.curriculumData === "object") {
      setLattesData(profile.curriculumData as LattesData);
    }
    if (profile.userType === "consultor" && profile.cnpj) loadCNPJData(profile.cnpj);
    if (profile.cpf) loadCPFData(profile.cpf);
  }, [profile?.curriculumData, profile?.cnpj, profile?.cpf, profile?.userType]);


  const loadCNPJData = async (cnpj: string) => {
    if (!cnpj) {
      console.warn("CNPJ não fornecido para carregamento");
      return;
    }
    
    setLoadingCNPJ(true);
    console.log("Carregando dados do CNPJ:", cnpj);
    try {
      const data = await fetchCNPJData(cnpj);
      console.log("Dados do CNPJ recebidos:", data);
      setCnpjData(data);
      if (data) {
        toast.success("Dados do CNPJ carregados");
      } else {
        toast.warning("Não foi possível carregar dados do CNPJ");
      }
    } catch (error) {
      console.error("Erro ao carregar dados do CNPJ:", error);
      toast.error(`Erro ao carregar dados do CNPJ: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setLoadingCNPJ(false);
    }
  };

  const loadCPFData = async (cpf: string) => {
    setLoadingCPF(true);
    try {
      const data = await fetchCPFData(cpf);
      setCpfData(data);
    } catch (error) {
      console.error("Erro ao carregar dados do CPF:", error);
    } finally {
      setLoadingCPF(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[color:var(--background)]">
      <Header />
      
      <div className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 border-b border-[color:var(--institutional-line)] pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="institutional-kicker mb-2">Dados institucionais</p>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Meu Perfil</h1>
            <p className="text-gray-600">Visualize informações de cadastro, currículo e assinatura.</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Link href="/perfil/editar">
              <Button variant="outline" className="border-primary text-primary hover:bg-secondary">
                Editar perfil
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline">Voltar ao painel</Button>
            </Link>
          </div>
        </div>

        {/* Informações Básicas */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Informações Básicas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="text-gray-900 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {user.email || <span className="text-gray-500 italic">Não disponível</span>}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Tipo de Usuário</label>
                <p className="text-gray-900">
                  <Badge variant={profile?.userType === "pesquisador" ? "default" : "secondary"}>
                    {profile?.userType === "pesquisador" ? "Pesquisador" : profile?.userType === "consultor" ? "Consultor" : "Não definido"}
                  </Badge>
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Área de atuação</label>
                <p className="text-gray-900">
                  {profile?.area ? getAreaLabel(profile.area) : <span className="text-gray-500 italic">Não informada</span>}
                </p>
              </div>

              {profile?.phone ? (
                <div>
                  <label className="text-sm font-medium text-gray-500">Telefone</label>
                  <p className="text-gray-900 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {formatPhone(profile.phone)}
                  </p>
                </div>
              ) : null}

              {profile?.cpf ? (
                <div>
                  <label className="text-sm font-medium text-gray-500">CPF</label>
                  <p className="text-gray-900">{formatCPF(profile.cpf)}</p>
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium text-gray-500">CPF</label>
                  <p className="text-gray-500 text-sm italic">Não cadastrado</p>
                </div>
              )}

              {profile?.userType === "consultor" && profile?.cnpj ? (
                <div>
                  <label className="text-sm font-medium text-gray-500">CNPJ</label>
                  <p className="text-gray-900">{formatCNPJ(profile.cnpj)}</p>
                </div>
              ) : profile?.userType === "consultor" ? (
                <div>
                  <label className="text-sm font-medium text-gray-500">CNPJ</label>
                  <p className="text-gray-500 text-sm italic">Não cadastrado</p>
                </div>
              ) : null}

            </div>

            {(!profile?.cpf && !profile?.cnpj) && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-800 mb-2">
                        Perfil incompleto
                      </p>
                      <p className="text-sm text-yellow-700 mb-3">
                        Complete seu cadastro adicionando CPF, CNPJ ou sua formação acadêmica na seção Currículo para aproveitar melhor os recursos da plataforma.
                      </p>
                      <Link href="/perfil/editar">
                        <Button variant="outline" size="sm" className="border-yellow-600 text-yellow-700 hover:bg-yellow-100">
                          Atualizar Perfil
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Assinatura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile?.stripeCustomerId || profile?.subscriptionStatus ? (
              <>
                <div className="grid gap-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-gray-500">Status:</span>
                    <Badge variant="secondary">
                      {profile.subscriptionStatus === "active"
                        ? "Ativa"
                        : profile.subscriptionStatus === "trialing"
                          ? "Período de teste"
                          : profile.subscriptionStatus === "past_due"
                            ? "Pagamento em atraso"
                            : profile.subscriptionStatus === "canceled"
                              ? "Cancelada"
                              : profile.subscriptionStatus || "—"}
                    </Badge>
                  </div>
                  <p className="text-gray-700">
                    Plano:{" "}
                    <span className="font-medium">
                      {profile.subscriptionPlanKey === "empresas"
                        ? "Empresas"
                        : profile.subscriptionPlanKey === "pro"
                          ? "Pro"
                          : profile.subscriptionPlanKey || "Gratuito"}
                    </span>
                  </p>
                  {profile.subscriptionCurrentPeriodEnd ? (
                    <p className="text-gray-600 text-sm">
                      Renovação / fim do período atual:{" "}
                      {new Date(profile.subscriptionCurrentPeriodEnd).toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  ) : null}
                </div>
                {profile.stripeCustomerId ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={portalLoading}
                    onClick={async () => {
                      setPortalLoading(true);
                      try {
                        const url = await createBillingPortalSession();
                        window.location.href = url;
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Erro ao abrir portal.");
                      } finally {
                        setPortalLoading(false);
                      }
                    }}
                  >
                    {portalLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Abrindo…
                      </>
                    ) : (
                      "Gerenciar assinatura e faturas"
                    )}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-gray-600"
                  disabled={syncLoading}
                  onClick={async () => {
                    setSyncLoading(true);
                    try {
                      const out = await syncSubscriptionFromStripe();
                      await refetch();
                      toast.success(
                        out.plan_key === "empresas"
                          ? "Plano Empresas sincronizado!"
                          : out.plan_key === "pro"
                            ? "Plano Pro sincronizado!"
                            : "Assinatura sincronizada.",
                      );
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Erro ao sincronizar assinatura.");
                    } finally {
                      setSyncLoading(false);
                    }
                  }}
                >
                  {syncLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sincronizando…
                    </>
                  ) : (
                    "Sincronizar assinatura com Stripe"
                  )}
                </Button>
              </>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="text-gray-700">
                  Plano: <span className="font-medium">Gratuito</span>
                </p>
                <p className="text-gray-600">
                  Você está no plano gratuito. Assine o Pro ou Empresas para desbloquear todos os recursos.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 px-0 h-auto"
                  disabled={syncLoading}
                  onClick={async () => {
                    setSyncLoading(true);
                    try {
                      const out = await syncSubscriptionFromStripe();
                      await refetch();
                      if (out.plan_key) {
                        toast.success("Assinatura encontrada e sincronizada!");
                      } else {
                        toast.info("Nenhuma assinatura ativa encontrada no Stripe.");
                      }
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Erro ao sincronizar assinatura.");
                    } finally {
                      setSyncLoading(false);
                    }
                  }}
                >
                  {syncLoading ? "Sincronizando assinatura…" : "Já assinei? Sincronizar com Stripe"}
                </Button>
              </div>
            )}
            <div className="pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">Pro</div>
                      <div className="text-xs text-gray-600 mt-1">Para pesquisadores e startups.</div>
                    </div>
                    {profile?.subscriptionPlanKey === "pro" ? (
                      <Badge variant="secondary">Atual</Badge>
                    ) : null}
                  </div>
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant={profile?.subscriptionPlanKey === "pro" ? "outline" : "attention"}
                      disabled={
                        !user ||
                        checkoutLoadingPlan !== null ||
                        profile?.subscriptionPlanKey === "pro"
                      }
                      onClick={async () => {
                        if (!user) {
                          toast.info("Faça login para assinar.");
                          setLocation(`/login?redirect=/perfil`);
                          return;
                        }
                        setCheckoutLoadingPlan("pro");
                        try {
                          const url = await createCheckoutSession("pro");
                          window.location.href = url;
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Erro ao abrir checkout.");
                        } finally {
                          setCheckoutLoadingPlan(null);
                        }
                      }}
                      className="w-full"
                    >
                      {checkoutLoadingPlan === "pro" ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Redirecionando…
                        </>
                      ) : profile?.subscriptionPlanKey === "pro" ? (
                        "Plano atual"
                      ) : (
                        "Fazer upgrade para Pro"
                      )}
                    </Button>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">Empresas</div>
                      <div className="text-xs text-gray-600 mt-1">Para times e operação multiusuário.</div>
                    </div>
                    {profile?.subscriptionPlanKey === "empresas" ? (
                      <Badge variant="secondary">Atual</Badge>
                    ) : null}
                  </div>
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant={profile?.subscriptionPlanKey === "empresas" ? "outline" : "attention"}
                      disabled={
                        !user ||
                        checkoutLoadingPlan !== null ||
                        profile?.subscriptionPlanKey === "empresas"
                      }
                      onClick={async () => {
                        if (!user) {
                          toast.info("Faça login para assinar.");
                          setLocation(`/login?redirect=/perfil`);
                          return;
                        }
                        setCheckoutLoadingPlan("empresas");
                        try {
                          const url = await createCheckoutSession("empresas");
                          window.location.href = url;
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Erro ao abrir checkout.");
                        } finally {
                          setCheckoutLoadingPlan(null);
                        }
                      }}
                      className="w-full"
                    >
                      {checkoutLoadingPlan === "empresas" ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Redirecionando…
                        </>
                      ) : profile?.subscriptionPlanKey === "empresas" ? (
                        "Plano atual"
                      ) : (
                        "Fazer upgrade para Empresas"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Programa de Referência */}
        <Card className="mb-6 institutional-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" />
              Programa de referência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-4">
              Compartilhe a Origem.Lab com sua rede e acompanhe os créditos por novos cadastros.
              Use seu link exclusivo para começar.
            </p>
            <Link href="/referencia">
              <Button className="bg-primary hover:bg-primary/90 text-white">
                <Share2 className="w-4 h-4 mr-2" />
                Ver meu link de referência
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Formação acadêmica (pesquisador) */}
        {profile && profile.userType === "pesquisador" && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" />
                  Formação acadêmica
                </span>
                {lattesData && !editingFormacao ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingFormacao(true);
                      setFormacaoFormKey((k) => k + 1);
                    }}
                  >
                    Editar formação
                  </Button>
                ) : null}
                {editingFormacao ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingFormacao(false)}
                  >
                    Cancelar
                  </Button>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!lattesData || editingFormacao) ? (
                <div className="space-y-4">
                  {!editingFormacao && (
                    <p className="text-gray-700">
                      Informe o maior nível de formação, área, universidade e ano. Se tiver doutorado, pediremos também o mestrado.
                    </p>
                  )}
                  <AcademicFormationForm
                    key={formacaoFormKey}
                    existing={lattesData || profile.curriculumData}
                    saving={savingFormacao}
                    onComplete={handleSaveFormacao}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {lattesData.nome ? (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Nome</label>
                      <p className="text-gray-900 font-semibold">{lattesData.nome}</p>
                    </div>
                  ) : null}

                  {lattesData.elegibilidade ? (
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-2 block">
                        Titulação
                      </label>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2">
                          {lattesData.elegibilidade.possuiDoutorado ? (
                            <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-gray-400 shrink-0" />
                          )}
                          <span className="text-sm font-medium text-gray-800">Doutorado</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2">
                          {lattesData.elegibilidade.possuiMestrado ? (
                            <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-gray-400 shrink-0" />
                          )}
                          <span className="text-sm font-medium text-gray-800">Mestrado</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {lattesData.elegibilidade.podeParticiparEditais ? (
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-600" />
                          )}
                          <span className="text-sm text-gray-700">
                            {lattesData.elegibilidade.podeParticiparEditais
                              ? "Elegível para participar de editais"
                              : "Não elegível para participar de editais"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center gap-2">
                            {lattesData.elegibilidade.possuiGraduacao ? (
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="text-xs text-gray-600">Graduação</span>
                          </div>
                          {lattesData.elegibilidade.anosExperiencia ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-primary" />
                              <span className="text-xs text-gray-600">
                                {lattesData.elegibilidade.anosExperiencia} anos de experiência
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {lattesData.formacao && lattesData.formacao.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Formação</label>
                      <div className="space-y-2 mt-2">
                        {[...lattesData.formacao]
                          .sort((a, b) => {
                            const rank = (nivel: string) => {
                              const n = String(nivel || "").toLowerCase();
                              if (n.includes("doutor")) return 0;
                              if (n.includes("mestr")) return 1;
                              if (n.includes("especial")) return 2;
                              if (n.includes("gradua") || n.includes("bacharel") || n.includes("licenc"))
                                return 3;
                              return 4;
                            };
                            return rank(a.nivel) - rank(b.nivel);
                          })
                          .map((formacao, idx) => (
                          <div key={idx} className="border-l-2 border-primary pl-4">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900">{formacao.nivel}</p>
                              {formacao.emAndamento && (
                                <Badge variant="outline" className="text-xs">Em andamento</Badge>
                              )}
                            </div>
                            <p className="text-gray-700">{formacao.curso}</p>
                            <p className="text-sm text-gray-600">{formacao.instituicao}</p>
                            {formacao.anoConclusao && (
                              <p className="text-sm text-gray-500">Concluído em {formacao.anoConclusao}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Áreas CNPq (pesquisador) */}
        {profile && profile.userType === "pesquisador" && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Áreas de atuação (CNPq)
                </span>
                {(() => {
                  const areas =
                    ((profile.curriculumData?.areasAtuacaoCnpq ||
                      (lattesData as CurriculumData | null)?.areasAtuacaoCnpq ||
                      []) as CnpqAreaAtuacao[]);
                  if (editingAreasCnpq && areas.length > 0) {
                    return (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingAreasCnpq(false)}
                      >
                        Cancelar
                      </Button>
                    );
                  }
                  if (!editingAreasCnpq && areas.length > 0) {
                    return (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingAreasCnpq(true);
                          setAreasCnpqFormKey((k) => k + 1);
                        }}
                      >
                        Editar áreas
                      </Button>
                    );
                  }
                  return null;
                })()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const areas =
                  ((profile.curriculumData?.areasAtuacaoCnpq ||
                    (lattesData as CurriculumData | null)?.areasAtuacaoCnpq ||
                    []) as CnpqAreaAtuacao[]);
                if (editingAreasCnpq || areas.length === 0) {
                  return (
                    <div className="space-y-4">
                      {areas.length === 0 && !editingAreasCnpq && (
                        <p className="text-gray-700">
                          Informe grande área, área, subárea e especialidade conforme a tabela do CNPq.
                        </p>
                      )}
                      <CnpqAreasAtuacaoForm
                        key={areasCnpqFormKey}
                        initial={areas}
                        saving={savingAreasCnpq}
                        onComplete={handleSaveAreasCnpq}
                      />
                    </div>
                  );
                }
                return (
                  <ul className="space-y-2">
                    {areas.map((a, i) => (
                      <li key={i} className="border-l-2 border-primary pl-4 text-sm text-gray-800">
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
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Dados do CNPJ — apenas consultor */}
        {profile && profile.userType === "consultor" && profile.cnpj ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Dados da Empresa (CNPJ)
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log("Botão Atualizar CNPJ clicado, CNPJ:", profile.cnpj);
                    loadCNPJData(profile.cnpj!);
                  }}
                  disabled={loadingCNPJ}
                >
                  {loadingCNPJ ? (
                    <Spinner className="w-4 h-4 mr-2" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  {cnpjData ? "Atualizar" : "Carregar"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCNPJ ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner />
                  <span className="ml-2 text-sm text-gray-600">Carregando dados do CNPJ...</span>
                </div>
              ) : cnpjData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Razão Social</label>
                      <p className="text-gray-900 font-semibold">{cnpjData.razaoSocial}</p>
                    </div>

                    {cnpjData.nomeFantasia && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Nome Fantasia</label>
                        <p className="text-gray-900">{cnpjData.nomeFantasia}</p>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium text-gray-500">Situação</label>
                      <p className="text-gray-900">
                        <Badge variant={cnpjData.situacao === "ATIVA" ? "default" : "destructive"}>
                          {cnpjData.situacao}
                        </Badge>
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">Data de Abertura</label>
                      <p className="text-gray-900 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {cnpjData.dataAbertura}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">Porte</label>
                      <p className="text-gray-900">{cnpjData.porte}</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">Natureza Jurídica</label>
                      <p className="text-gray-900">{cnpjData.naturezaJuridica}</p>
                    </div>
                  </div>

                  {cnpjData.endereco && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Endereço</label>
                      <p className="text-gray-900 flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-1" />
                        <span>
                          {cnpjData.endereco.logradouro}, {cnpjData.endereco.numero}
                          {cnpjData.endereco.complemento && ` - ${cnpjData.endereco.complemento}`}
                          <br />
                          {cnpjData.endereco.bairro} - {cnpjData.endereco.municipio}/{cnpjData.endereco.uf}
                          <br />
                          CEP: {formatCEP(cnpjData.endereco.cep)}
                        </span>
                      </p>
                    </div>
                  )}

                  {cnpjData.atividades && cnpjData.atividades.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Atividades</label>
                      <div className="space-y-2 mt-2">
                        {cnpjData.atividades.map((atividade, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <Badge variant={atividade.principal ? "default" : "outline"}>
                              {atividade.principal ? "Principal" : "Secundária"}
                            </Badge>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{atividade.descricao}</p>
                              <p className="text-xs text-gray-500">Código: {atividade.codigo}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {cnpjData.telefones && cnpjData.telefones.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Telefones</label>
                      <p className="text-gray-900 flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {cnpjData.telefones.join(", ")}
                      </p>
                    </div>
                  )}

                  {cnpjData.email && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Email</label>
                      <p className="text-gray-900 flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {cnpjData.email}
                      </p>
                    </div>
                  )}

                  {cnpjData.elegibilidade && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <label className="text-sm font-medium text-gray-500 mb-2 block">Elegibilidade para Editais</label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {cnpjData.elegibilidade.podeParticiparEditais ? (
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-600" />
                          )}
                          <span className="text-sm text-gray-700">
                            {cnpjData.elegibilidade.podeParticiparEditais ? "Elegível para participar de editais" : "Não elegível para participar de editais"}
                          </span>
                        </div>

                        {cnpjData.elegibilidade.tempoAtividade && (
                          <div className="flex items-center gap-2 mt-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            <span className="text-sm text-gray-600">
                              {cnpjData.elegibilidade.tempoAtividade} meses de atividade
                            </span>
                          </div>
                        )}

                        {cnpjData.elegibilidade.observacoes && cnpjData.elegibilidade.observacoes.length > 0 && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
                            <p className="text-sm font-medium text-yellow-800 mb-1">Observações:</p>
                            <ul className="text-sm text-yellow-700 list-disc list-inside">
                              {cnpjData.elegibilidade.observacoes.map((obs, idx) => (
                                <li key={idx}>{obs}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                  <p>Nenhum dado do CNPJ encontrado</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      console.log("Tentando carregar CNPJ:", profile.cnpj);
                      loadCNPJData(profile.cnpj!);
                    }}
                  >
                    Tentar Carregar
                  </Button>
                  <p className="text-xs text-gray-400 mt-2">
                    CNPJ cadastrado: {formatCNPJ(profile.cnpj)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : profile && profile.userType === "consultor" ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Dados da Empresa (CNPJ)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p className="mb-4">CNPJ não cadastrado no perfil</p>
                <Link href="/perfil/editar">
                  <Button variant="outline" size="sm">
                    Adicionar CNPJ
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Dados do CPF */}
        {profile && profile.cpf && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Validação CPF
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cpfData ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Situação</label>
                    <p className="text-gray-900">
                      <Badge variant={cpfData.situacao === "Válido" ? "default" : "destructive"}>
                        {cpfData.situacao}
                      </Badge>
                    </p>
                  </div>

                  {cpfData.elegibilidade && (
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-2 block">Elegibilidade para Editais</label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {cpfData.elegibilidade.podeParticiparEditais ? (
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-600" />
                          )}
                          <span className="text-sm text-gray-700">
                            {cpfData.elegibilidade.podeParticiparEditais ? "Elegível para participar de editais" : "Não elegível para participar de editais"}
                          </span>
                        </div>
                        
                        {cpfData.elegibilidade.observacoes && cpfData.elegibilidade.observacoes.length > 0 && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
                            <p className="text-sm font-medium text-yellow-800 mb-1">Observações:</p>
                            <ul className="text-sm text-yellow-700 list-disc list-inside">
                              {cpfData.elegibilidade.observacoes.map((obs, idx) => (
                                <li key={idx}>{obs}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">
                  Informações detalhadas de CPF não estão disponíveis publicamente por questões de privacidade.
                </p>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}

