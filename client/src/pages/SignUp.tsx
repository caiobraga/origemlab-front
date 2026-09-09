import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Spinner } from "@/components/ui/spinner";
import Header from "@/components/Header";
import { saveUserProfile, type UserType } from "@/lib/userProfile";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { translateSupabaseAuthError } from "@/lib/authErrorTranslations";
import {
  getStoredReferralCode,
  clearStoredReferralCode,
  getReferrerByCode,
  recordReferralConversion,
} from "@/lib/referralApi";
import { recordSignupAttribution } from "@/lib/attribution";
import {
  getEmailConfirmRedirectUrl,
  isLikelyExistingUnconfirmedSignup,
  resendSignupConfirmationEmail,
} from "@/lib/authEmailConfirmation";
import { markPendingAuthFlow } from "@/lib/authCallbackUrl";
import { stashPendingSignupProfile } from "@/lib/pendingSignupProfile";
import { Eye, EyeOff } from "lucide-react";

export default function SignUp() {
  const [, setLocation] = useLocation();
  const [userType, setUserType] = useState<UserType>("pesquisador");
  
  // Campos comuns
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [cpf, setCpf] = useState("");
  
  // Campos específicos de consultor (primeira empresa opcional)
  const [hasCnpj, setHasCnpj] = useState<string>("nao");
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  
  // Consentimento de coleta de dados (LGPD)
  const [dataCollectionConsent, setDataCollectionConsent] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const { signUp, user, signIn } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const [location] = useLocation();

  // Se já estiver logado: após carregar perfil, ir ao onboarding (se não completou) ou ao dashboard
  useEffect(() => {
    if (!user || profileLoading) return;
    setLocation(profile?.onboardingCompleted ? "/dashboard" : "/onboarding?new=1");
  }, [user, profileLoading, profile?.onboardingCompleted, setLocation]);

  // Preencher email da URL se disponível
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      return;
    }

    // Validações específicas
    if (!cpf) {
      toast.error("CPF é obrigatório");
      return;
    }

    if (userType === "consultor" && hasCnpj === "sim" && !cnpj) {
      toast.error("CNPJ é obrigatório quando você informa a primeira empresa");
      return;
    }

    // Validação de consentimento (LGPD)
    if (!dataCollectionConsent) {
      toast.error("É necessário consentir com a coleta de dados para criar uma conta");
      return;
    }

    setLoading(true);

    try {
      // Preparar dados do perfil - limpar formatação do CPF e CNPJ
      const cpfLimpo = cpf.replace(/\D/g, "");
      const cnpjLimpo = cnpj.replace(/\D/g, "");
      
      const profileData = {
        cpf: cpfLimpo || undefined,
        cnpj: userType === "consultor" && hasCnpj === "sim" && cnpjLimpo ? cnpjLimpo : undefined,
        userType,
        hasCnpj: userType === "consultor" && hasCnpj === "sim",
        dataCollectionConsent: dataCollectionConsent,
        consentVersion: "1.0", // Versão atual do termo de consentimento
      };

      console.log("Dados do perfil a serem salvos:", profileData);

      markPendingAuthFlow("signup");

      // Fazer o signUp básico (perfil em user_metadata — funciona sem sessão)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getEmailConfirmRedirectUrl(),
          data: {
            profile: profileData,
            userType: profileData.userType,
            hasCnpj: profileData.hasCnpj || false,
            cpf: profileData.cpf,
            cnpj: profileData.cnpj,
            dataCollectionConsent: profileData.dataCollectionConsent,
            consentVersion: profileData.consentVersion,
          },
        },
      });

      if (signUpError) {
        console.error("Erro no signup:", signUpError);
        throw signUpError;
      }

      if (!signUpData.user) {
        console.error("Usuário não retornado do signup");
        toast.error("Erro ao criar conta. Tente novamente.");
        return;
      }

      // Email já cadastrado: Supabase pode retornar user sem identities e sem enviar email.
      if (isLikelyExistingUnconfirmedSignup(signUpData.user)) {
        const { error: resendError } = await resendSignupConfirmationEmail(email);
        if (resendError) {
          toast.error(
            "Este email já está cadastrado. Tente entrar ou reenviar a confirmação na tela de login.",
          );
        } else {
          toast.success(
            "Este email já tinha cadastro. Reenviamos o link de confirmação — confira a caixa de entrada e o spam.",
          );
        }
        setLocation(`/login?precisaConfirmar=1&email=${encodeURIComponent(email)}`);
        return;
      }

      console.log("Usuário criado:", signUpData.user.id);

      // Com "Confirm email" ativo NÃO há sessão → /api/profile retorna 401 (esperado).
      // Guardamos o perfil e salvamos após confirmar + login.
      stashPendingSignupProfile(email, profileData);

      if (signUpData.session) {
        try {
          await saveUserProfile(signUpData.user.id, profileData);
        } catch (profileError) {
          console.warn("Perfil será aplicado no próximo login:", profileError);
        }
        try {
          await signIn(email, password);
        } catch (signInError) {
          console.warn("Login no backend após cadastro:", signInError);
        }
        toast.success("Conta criada com sucesso!");
        setLocation("/onboarding?new=1");
      } else {
        toast.success(
          "Conta criada! Enviamos um email de confirmação — confira também spam/Promoções.",
        );
        setLocation(
          `/login?precisaConfirmar=1&email=${encodeURIComponent(email)}`,
        );
      }

      // Registrar referência se veio de um link de indicação (best-effort; pode falhar sem sessão)
      const referralCode = getStoredReferralCode();
      if (referralCode && signUpData.session) {
        try {
          const referrerId = await getReferrerByCode(referralCode);
          if (referrerId && referrerId !== signUpData.user.id) {
            const recorded = await recordReferralConversion(referrerId, signUpData.user.id);
            if (recorded) {
              toast.success("Indicação registrada! Você e quem te indicou ganham créditos.");
            }
          }
          clearStoredReferralCode();
        } catch (refError) {
          console.warn("Erro ao registrar referência:", refError);
        }
      }

      if (signUpData.session) {
        await recordSignupAttribution(signUpData.user.id);
      }
    } catch (error: any) {
      console.error("Erro completo no signup:", error);
      toast.error(translateSupabaseAuthError(error, "Erro ao criar conta. Tente novamente."));
    } finally {
      setLoading(false);
    }
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return value;
  };

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 14) {
      return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return value;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center bg-[color:var(--background)] px-4 py-12">
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-lg shadow-xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-primary">
                Criar nova conta
              </h1>
              <p className="text-gray-600 mt-2">
                Escolha o tipo de conta e preencha os dados abaixo
              </p>
            </div>

            <Tabs value={userType} onValueChange={(value) => setUserType(value as UserType)} className="w-full">
              <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 mb-6 h-auto p-1 gap-1 sm:gap-0 sm:h-9">
                <TabsTrigger value="pesquisador" className="whitespace-normal py-3 sm:py-1 min-h-[44px] sm:min-h-0 text-center">
                  Pesquisador
                </TabsTrigger>
                <TabsTrigger value="consultor" className="whitespace-normal py-3 sm:py-1 min-h-[44px] sm:min-h-0 text-center">
                  Consultor
                </TabsTrigger>
              </TabsList>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Campos comuns */}
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email <span className="text-red-600" aria-hidden="true">*</span>
                    <span className="sr-only"> (obrigatório)</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">
                      Senha <span className="text-red-600" aria-hidden="true">*</span>
                      <span className="sr-only"> (obrigatório)</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                        minLength={6}
                        className="w-full pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        aria-pressed={showPassword}
                        disabled={loading}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" aria-hidden />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">Mínimo de 6 caracteres</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">
                      Confirmar Senha <span className="text-red-600" aria-hidden="true">*</span>
                      <span className="sr-only"> (obrigatório)</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={loading}
                        minLength={6}
                        className="w-full pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        aria-label={showConfirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                        aria-pressed={showConfirmPassword}
                        disabled={loading}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" aria-hidden />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden />
                        )}
                      </button>
                    </div>
                    {password && confirmPassword && password !== confirmPassword && (
                      <p className="text-xs text-red-500">As senhas não coincidem</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf">
                    CPF <span className="text-red-600" aria-hidden="true">*</span>
                    <span className="sr-only"> (obrigatório)</span>
                  </Label>
                  <Input
                    id="cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(formatCPF(e.target.value))}
                    required
                    disabled={loading}
                    maxLength={14}
                    className="w-full"
                  />
                </div>

                {/* Aba Pesquisador */}
                <TabsContent value="pesquisador" className="space-y-6">
                  <p className="text-sm text-gray-600">
                    Conta individual gratuita. Cadastre projetos e encontre editais compatíveis. Você pode enviar o currículo (Lattes/PDF) depois no perfil.
                  </p>
                </TabsContent>

                {/* Aba Consultor */}
                <TabsContent value="consultor" className="space-y-6">
                  <div className="rounded-lg border border-border bg-secondary/40 p-4 mb-2">
                    <p className="text-sm text-gray-800">
                      <strong>Consultor:</strong> gerencie várias empresas e projetos por empresa. Você pode cadastrar a primeira empresa agora ou depois em Minhas empresas.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <Label>Cadastrar primeira empresa agora?</Label>
                    <RadioGroup value={hasCnpj} onValueChange={setHasCnpj} disabled={loading}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sim" id="cnpj-sim" />
                        <Label htmlFor="cnpj-sim" className="cursor-pointer font-normal">Sim, informar CNPJ</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao" id="cnpj-nao" />
                        <Label htmlFor="cnpj-nao" className="cursor-pointer font-normal">Depois</Label>
                      </div>
                    </RadioGroup>

                    {hasCnpj === "sim" && (
                      <div className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="razao-social">Razão social</Label>
                          <Input
                            id="razao-social"
                            type="text"
                            placeholder="Empresa Exemplo Ltda"
                            value={razaoSocial}
                            onChange={(e) => setRazaoSocial(e.target.value)}
                            disabled={loading}
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cnpj">
                            CNPJ <span className="text-red-600" aria-hidden="true">*</span>
                            <span className="sr-only"> (obrigatório)</span>
                          </Label>
                          <Input
                            id="cnpj"
                            type="text"
                            placeholder="00.000.000/0000-00"
                            value={cnpj}
                            onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                            required={hasCnpj === "sim"}
                            disabled={loading}
                            maxLength={18}
                            className="w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Consentimento de coleta de dados (LGPD) */}
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="data-consent"
                      checked={dataCollectionConsent}
                      onCheckedChange={(checked) => setDataCollectionConsent(checked === true)}
                      disabled={loading}
                      className="mt-1"
                      aria-required="true"
                    />
                    <div className="flex-1">
                      <Label 
                        htmlFor="data-consent" 
                        className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer"
                      >
                        Consentimento para coleta de dados pessoais (LGPD){" "}
                        <span className="text-red-600" aria-hidden="true">*</span>
                        <span className="sr-only"> (obrigatório)</span>
                      </Label>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Eu concordo com a coleta e processamento dos meus dados pessoais (CPF, CNPJ, email, etc.) 
                        pela Origem.Lab para fins de prestação de serviços, melhoria da plataforma e comunicação. 
                        Posso revogar este consentimento a qualquer momento através das configurações da minha conta. 
                        Para mais informações, consulte nossa{" "}
                        <Link 
                          href="/politica-privacidade" 
                          className="text-primary dark:text-blue-400 hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
                          aria-label="Ler política de privacidade"
                        >
                          política de privacidade
                        </Link>
                        .
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-white mt-6"
                  disabled={
                    loading || 
                    !cpf ||
                    (password !== confirmPassword && confirmPassword !== "") ||
                    (userType === "consultor" && hasCnpj === "sim" && !cnpj) ||
                    !dataCollectionConsent
                  }
                >
                  {loading ? (
                    <>
                      <Spinner className="mr-2" />
                      Criando conta...
                    </>
                  ) : (
                    "Criar Conta"
                  )}
                </Button>
              </form>

              <div className="text-center text-sm text-gray-600 mt-6">
                Já tem uma conta?{" "}
                <Link href="/login">
                  <span className="text-primary hover:text-primary/80 font-medium cursor-pointer">
                    Entrar
                  </span>
                </Link>
              </div>

              <div className="text-center mt-4 space-y-2">
                <Link href="/referencia">
                  <span className="block text-sm text-primary hover:text-primary/80 font-medium cursor-pointer">
                    Rede de acesso
                  </span>
                </Link>
                <Link href="/">
                  <span className="block text-sm text-gray-500 hover:text-gray-700 cursor-pointer">
                    ← Voltar para a página inicial
                  </span>
                </Link>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

