const steps = [
  {
    title: "Conte quem você é",
    description:
      "Informe sua área, titulação e instituição, ou envie o PDF do seu currículo Lattes para preencher o perfil. Empresas cadastram seus dados e projetos.",
  },
  {
    title: "Receba indicações com motivo",
    description:
      "Cada edital indicado mostra por que combina com o seu perfil e o que pode impedir a sua participação.",
  },
  {
    title: "Leia o essencial",
    description:
      "Prazo, valor e quem pode concorrer aparecem em uma ficha curta, com o link para o edital oficial.",
  },
  {
    title: "Escreva a proposta",
    description:
      "O editor traz as seções de uma proposta de fomento e a IA sugere textos a partir do edital e do seu projeto. A versão final é sua.",
  },
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="scroll-mt-20 bg-paper py-20 md:py-24">
      <div className="container">
        <div className="max-w-2xl">
          <h2 className="section-title">
            Como funciona
          </h2>
          <p className="mt-4 text-lg text-gray-700">
            Do cadastro à proposta pronta para enviar à agência.
          </p>
        </div>

        <ol className="mt-12 grid gap-10 md:mt-14 md:grid-cols-2 xl:grid-cols-4 xl:gap-8">
          {steps.map((step, index) => (
            <li key={step.title} className="border-t-2 border-ink pt-5">
              <span className="font-display text-lg font-semibold text-primary" aria-hidden="true">{index + 1}.</span>
              <h3 className="mt-2 text-lg font-semibold tracking-normal text-ink">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-gray-700">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
