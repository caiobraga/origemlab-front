import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthProvider";
import { ActiveEmpresaProvider } from "./contexts/ActiveEmpresaProvider";
import Home from "./pages/Home";
import Inicio from "./pages/Inicio";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import AuthCallback from "./pages/AuthCallback";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import EditalDetails from "./pages/EditalDetails";
import MinhasPropostas from "./pages/MinhasPropostas";
import MinhasEmpresas from "./pages/MinhasEmpresas";
import EmpresaWorkspace from "./pages/EmpresaWorkspace";
import MeusProjetos from "./pages/MeusProjetos";
import ProjetoEditais from "./pages/ProjetoEditais";
import ProjetoDetalhe from "./pages/ProjetoDetalhe";
import EditorProposta from "./pages/EditorProposta";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Demo from "./pages/Demo";
import Referencia from "./pages/Referencia";
import RefRedirect from "./pages/RefRedirect";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import Sobre from "./pages/Sobre";
import Contato from "./pages/Contato";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import TermosDeUso from "./pages/TermosDeUso";
import Cookies from "./pages/Cookies";
import Planos from "./pages/Planos";
import AdminDashboard from "./pages/AdminDashboard";
import CookieBanner from "./components/CookieBanner";
import RouteScrollRestoration from "./components/RouteScrollRestoration";
import { useEffect } from "react";
import { captureAttributionFromUrl } from "@/lib/attribution";

function AttributionCapture() {
  useEffect(() => {
    captureAttributionFromUrl();
  }, []);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/inicio"} component={Inicio} />
      <Route path={"/login"} component={Login} />
      <Route path={"/auth/callback"} component={AuthCallback} />
      <Route path={"/esqueci-a-senha"} component={ForgotPassword} />
      <Route path={"/redefinir-senha"} component={ResetPassword} />
      <Route path={"/cadastro"} component={SignUp} />
      <Route path={"/onboarding"} component={Onboarding} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/perfil"} component={Profile} />
      <Route path={"/perfil/editar"} component={EditProfile} />
      <Route path={"/demo"} component={Demo} />
      <Route path={"/referencia"} component={Referencia} />
      <Route path={"/ref/:code"} component={RefRedirect} />
      <Route path={"/edital/:id"} component={EditalDetails} />
      <Route path={"/minhas-propostas"} component={MinhasPropostas} />
      <Route path={"/minhas-empresas"} component={MinhasEmpresas} />
      <Route path={"/empresas/:id"} component={EmpresaWorkspace} />
      <Route path={"/meus-projetos"} component={MeusProjetos} />
      <Route path={"/projetos/:id/editais"} component={ProjetoEditais} />
      <Route path={"/projetos/:id"} component={ProjetoDetalhe} />
      <Route path={"/propostas/:id"} component={EditorProposta} />
      <Route path={"/sobre"} component={Sobre} />
      <Route path={"/contato"} component={Contato} />
      <Route path={"/politica-privacidade"} component={PoliticaPrivacidade} />
      <Route path={"/termos-de-uso"} component={TermosDeUso} />
      <Route path={"/cookies"} component={Cookies} />
      <Route path={"/planos"} component={Planos} />
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos - dados considerados frescos
      cacheTime: 10 * 60 * 1000, // 10 minutos - mantém cache em memória (v4)
    },
  },
});

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ActiveEmpresaProvider>
        <ThemeProvider
          defaultTheme="light"
          // switchable
        >
          <TooltipProvider>
            <Toaster />
            <AttributionCapture />
            <RouteScrollRestoration />
            <Router />
            <CookieBanner />
          </TooltipProvider>
        </ThemeProvider>
        </ActiveEmpresaProvider>
      </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
