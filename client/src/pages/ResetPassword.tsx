import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import Header from "@/components/Header";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  establishAuthSessionFromUrl,
  humanizeAuthLinkError,
  stripAuthParamsFromPath,
} from "@/lib/authCallbackUrl";
import { translateSupabaseAuthError } from "@/lib/authErrorTranslations";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await establishAuthSessionFromUrl();
        if (cancelled) return;
        if (!result.ok) {
          setBootError(result.error);
          setReady(true);
          return;
        }
        // Confirmação de email (e links ambíguos) às vezes caem nesta rota.
        if (result.flow !== "recovery") {
          setLocation("/login?emailConfirmado=1");
          return;
        }
        stripAuthParamsFromPath("/redefinir-senha");
        setReady(true);
      } catch (e) {
        console.warn("Reset password boot failed:", e);
        if (!cancelled) {
          setBootError(humanizeAuthLinkError(e, { ambiguous: true }));
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(
          humanizeAuthLinkError(error, { recovery: true }).includes("não é mais válido")
            ? humanizeAuthLinkError(error, { recovery: true })
            : translateSupabaseAuthError(error, "Não foi possível atualizar a senha. Tente de novo ou cadastre-se."),
        );
        return;
      }
      toast.success("Senha atualizada! Você já pode usar a nova senha.");
      setLocation("/login");
    } catch (err) {
      toast.error(translateSupabaseAuthError(err, "Não foi possível atualizar a senha."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main
        id="main-content"
        className="flex-1 flex items-center justify-center bg-[color:var(--background)] px-4 py-12"
      >
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-primary">Nova senha</h1>
              <p className="text-gray-700 mt-2">
                {bootError
                  ? "Não foi possível continuar com este link."
                  : "Defina uma nova senha para sua conta."}
              </p>
            </div>

            {!ready ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
                <p className="text-sm text-gray-600">Validando link…</p>
              </div>
            ) : bootError ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-gray-800">{bootError}</p>
                <div className="flex flex-col gap-2 pt-2">
                  <Link href="/login">
                    <span className="block w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 cursor-pointer">
                      Ir para o login
                    </span>
                  </Link>
                  <Link href="/esqueci-a-senha">
                    <span className="block text-sm text-primary hover:text-primary/80 font-medium cursor-pointer">
                      Pedir outro link de recuperação
                    </span>
                  </Link>
                  <Link href="/cadastro">
                    <span className="block text-sm text-gray-600 hover:text-gray-800 cursor-pointer">
                      Criar nova conta
                    </span>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6" aria-label="Definir nova senha">
                <div className="space-y-2">
                  <Label htmlFor="password">
                    Nova senha <span className="text-red-600" aria-hidden="true">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      disabled={loading}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">
                    Confirmar senha <span className="text-red-600" aria-hidden="true">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      disabled={loading}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                      onClick={() => setShowConfirm((v) => !v)}
                      aria-label={showConfirm ? "Ocultar confirmação" : "Mostrar confirmação"}
                      disabled={loading}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword ? (
                    <p className="text-sm text-red-600">As senhas não coincidem.</p>
                  ) : null}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                  disabled={loading || password !== confirmPassword}
                >
                  {loading ? (
                    <>
                      <Spinner className="mr-2" />
                      Salvando…
                    </>
                  ) : (
                    "Salvar nova senha"
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
