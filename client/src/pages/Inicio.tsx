import Header from "@/components/Header";
import { useScrollToHashOnLoad } from "@/lib/landingSections";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Pricing from "@/components/Pricing";
import FaqSection from "@/components/FaqSection";
import Footer from "@/components/Footer";
import AIHumanSection from "@/components/AIHumanSection";

/** Página inicial/landing sempre visível (sem redirecionar logados para o dashboard). Usada pelo logo. */
export default function Inicio() {
  useScrollToHashOnLoad(true);
  return (
    <div className="flex-1">
      <Header />
      <main id="main-content">
        <Hero />
        <HowItWorks />
        <AIHumanSection />
        <Pricing />
        <FaqSection />
      </main>
      <Footer />
    </div>
  );
}
