import { usePublicCatalogStats } from "@/hooks/usePublicCatalogStats";

export default function AIHumanSection() {
  const { data: stats } = usePublicCatalogStats();

  const fontes =
    stats && stats.fontesCount > 0
      ? `${stats.fontesCount.toLocaleString("pt-BR")} fontes de fomento`
      : "agências e fundações de fomento";
  const analisados =
    stats && stats.editaisAnalisadosCount > 0
      ? ` Até hoje, ${stats.editaisAnalisadosCount.toLocaleString("pt-BR")} editais passaram por essa leitura.`
      : "";

  const principles = [
    {
      title: "Vem do documento oficial",
      text: `Coletamos os editais nos sites de ${fontes} e guardamos o link para o documento publicado. Em caso de dúvida, vale o que está no edital.`,
    },
    {
      title: "É conferido com o próprio documento",
      text: `Prazo, valor e público-alvo são extraídos automaticamente e conferidos com o texto do edital antes de ele entrar no catálogo.${analisados}`,
    },
    {
      title: "A IA ajuda, você decide",
      text: "A IA sugere estrutura e texto para a proposta. O que vai para a agência é revisado e enviado por você.",
    },
  ];

  return (
    <section className="border-y border-line bg-white py-20 md:py-24">
      <div className="container grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
        <div>
          <h2 className="section-title">
            De onde vem cada informação
          </h2>
          <p className="mt-4 max-w-md text-lg text-gray-700">
            Para decidir se vale concorrer, você precisa confiar no que lê. Por isso cada ficha
            leva ao edital publicado pela agência.
          </p>
        </div>

        <dl className="divide-y divide-line border-y border-line">
          {principles.map((item) => (
            <div key={item.title} className="grid gap-2 py-6 sm:grid-cols-[12rem_1fr] sm:gap-8">
              <dt className="font-semibold text-ink">{item.title}</dt>
              <dd className="leading-relaxed text-gray-700">{item.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
