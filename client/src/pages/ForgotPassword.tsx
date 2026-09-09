import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import Header from "@/components/Header";
import { toast } from "sonner";
import { requestPasswordResetEmail } from "@/lib/authEmailConfirmation";
import { markPendingAuthFlow } from "@/lib/authCallbackUrl";
import { translateSupabaseAuthError } from "@/lib/authErrorTranslations";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      markPendingAuthFlow("recovery");
      const { error } = await requestPasswordResetEmail(email);
      if (error) {
        toast.error(translateSupabaseAuthError(error, error.message));
        return;
      }
      // Mesma mensagem se o email existir ou não (anti-enumeração).
      setSent(true);
      toast.success("Se houver conta com este email, enviamos o link de recuperação.");
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
              <h1 className="text-3xl font-bold text-primary">Recuperar senha</h1>
              <p className="text-gray-700 mt-2">
                Informe o email da sua conta. Enviaremos um link para criar uma nova senha.
              </p>
            </div>

            {sent ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-gray-700">
                  Se houver conta com este email, o link já foi solicitado. Confira{" "}
                  <strong>spam / Promoções</strong>.
                </p>
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3 text-left">
                  <strong>Importante:</strong> abra o link neste <em>mesmo navegador</em> em que
                  você pediu a recuperação. Se o email abrir no app do celular, copie o link e
                  cole na barra de endereço deste navegador.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setSent(false)}
                >
                  Enviar de novo
                </Button>
                <Link href="/login">
                  <span className="block text-sm text-primary hover:text-primary/80 font-medium cursor-pointer mt-2">
                    Voltar ao login
                  </span>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6" aria-label="Recuperar senha">
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email <span className="text-red-600" aria-hidden="true">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Spinner className="mr-2" />
                      Enviando…
                    </>
                  ) : (
                    "Enviar link de recuperação"
                  )}
                </Button>

                <div className="text-center text-sm text-gray-700">
                  <Link href="/login">
                    <span className="text-primary hover:text-primary/80 font-medium cursor-pointer">
                      ← Voltar ao login
                    </span>
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
