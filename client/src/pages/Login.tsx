import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { getUserProfile, resolvePostLoginPath } from "@/lib/userProfile";
import { Spinner } from "@/components/ui/spinner";
import Header from "@/components/Header";
import { Eye, EyeOff, Mail } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { resendSignupConfirmationEmail } from "@/lib/authEmailConfirmation";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConfirmHelp, setShowConfirmHelp] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { signIn, user } = useAuth();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get("redirect");
    if (redirect) {
      sessionStorage.setItem("loginRedirect", redirect);
    }

    // Nunca apague ?code= / token_hash — isso quebra a confirmação PKCE.
    // Links de email devem ir para /auth/callback; aqui só limpamos flags de UI.
    const stripUiFlagsOnly = () => {
      const next = new URL(window.location.href);
      next.searchParams.delete("emailConfirmado");
      next.searchParams.delete("precisaConfirmar");
      next.searchParams.delete("email");
      next.searchParams.delete("erro");
      next.searchParams.delete("redirect");
      const qs = next.searchParams.toString();
      window.history.replaceState({}, "", `${next.pathname}${qs ? `?${qs}` : ""}${next.hash}`);
    };

    if (urlParams.get("emailConfirmado") === "1") {
      toast.success("Email confirmado! Agora faça login com sua senha.");
      const t = window.setTimeout(() => stripUiFlagsOnly(), 50);
      return () => window.clearTimeout(t);
    }
    if (urlParams.get("precisaConfirmar") === "1") {
      const em = urlParams.get("email");
      if (em) setEmail(decodeURIComponent(em));
      setShowConfirmHelp(true);
      const err = urlParams.get("erro");
      if (err) {
        toast.error(decodeURIComponent(err));
      }
      const t = window.setTimeout(() => stripUiFlagsOnly(), 50);
      return () => window.clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => {
      setResendCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  // Redirect if already logged in (usa perfil do banco para saber se onboarding foi concluído)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    resolvePostLoginPath(user)
      .then((path) => {
        if (!cancelled) setLocation(path);
      })
      .catch(() => {
        if (!cancelled) setLocation("/onboarding?new=1");
      });
    return () => {
      cancelled = true;
    };
  }, [user, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setNeedsEmailConfirmation(false);
    try {
      const loggedInUser = await signIn(email, password);
      const path = await resolvePostLoginPath(loggedInUser);
      setLocation(path);
    } catch (error: unknown) {
      const e = error as { code?: string; message?: string };
      const code = String(e?.code ?? "").toLowerCase();
      const msg = String(e?.message ?? "").toLowerCase();
      if (
        code === "email_not_confirmed" ||
        msg.includes("email not confirmed") ||
        msg.includes("confirm your email") ||
        msg.includes("email address is not confirmed")
      ) {
        setNeedsEmailConfirmation(true);
        setShowConfirmHelp(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    setResendLoading(true);
    try {
      const { error } = await resendSignupConfirmationEmail(email);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Enviamos outro email. Confira também o spam.");
      setResendCooldown(60);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main-content" className="flex-1 flex items-center justify-center bg-[color:var(--background)] px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-primary">
                Bem-vindo de volta
              </h1>
              <p className="text-gray-700 mt-2">
                Digite suas credenciais para acessar sua conta
              </p>
            </div>

            {(showConfirmHelp || needsEmailConfirmation) && (
              <Alert className="mb-6 border-amber-200 bg-amber-50 text-amber-950 [&>svg]:text-amber-800">
                <Mail className="h-4 w-4" aria-hidden />
                <AlertTitle>Confirme seu email</AlertTitle>
                <AlertDescription className="text-amber-900/90 space-y-3 mt-1">
                  <p>
                    Enviamos um link de confirmação após o cadastro.{" "}
                    <strong>Enquanto não clicar nesse link, o login falha.</strong> Verifique spam e
                    a pasta Promoções.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-amber-400 bg-white hover:bg-amber-100"
                    onClick={() => void handleResendConfirmation()}
                    disabled={resendLoading || resendCooldown > 0 || !email.trim()}
                  >
                    {resendLoading
                      ? "Enviando…"
                      : resendCooldown > 0
                        ? `Reenviar em ${resendCooldown}s`
                        : "Reenviar email de confirmação"}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6" aria-label="Formulário de login">
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
                  aria-required="true"
                  aria-describedby="email-description"
                />
                <span id="email-description" className="sr-only">Digite seu endereço de email</span>
              </div>

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
                    aria-required="true"
                    aria-describedby="password-description"
                    autoComplete="current-password"
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
                <span id="password-description" className="sr-only">Digite sua senha (mínimo de 6 caracteres)</span>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-white"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner className="mr-2" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>

            {import.meta.env.DEV ? (
              <p className="text-center text-xs text-gray-500 mt-4">
                Dev: para entrar sem email, no Supabase use{" "}
                <span className="font-medium">Authentication → Providers → Email → Confirm email (off)</span>.
              </p>
            ) : null}

            <div className="text-center text-sm text-gray-700 mt-6">
              Não tem uma conta?{" "}
              <Link href="/cadastro">
                <span className="text-primary hover:text-primary/80 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:rounded">
                  Criar conta
                </span>
              </Link>
            </div>

            <div className="text-center mt-4 space-y-2">
              <Link href="/referencia">
                <span className="block text-sm text-primary hover:text-primary/80 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:rounded">
                  Rede de acesso
                </span>
              </Link>
              <Link href="/">
                <span className="block text-sm text-gray-600 hover:text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:rounded">
                  ← Voltar para a página inicial
                </span>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

