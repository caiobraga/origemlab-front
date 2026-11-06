/**
 * Estrutura escrita de um Projeto (ativo reutilizável).
 * Mais completa que a proposta: reúne o corpus científico/tecnológico
 * para reuso em vários editais (modelo alinhado a chamadas CNPq/DT e similares).
 */

export type ProjetoOrigemTipo =
  | "proposta_anterior"
  | "projeto_pesquisa"
  | "ideia_nova"
  | "outro";

export type ProjetoConteudo = {
  /** De onde veio este material */
  origem?: {
    tipo?: ProjetoOrigemTipo | null;
    descricao?: string;
    ano?: string;
  };

  /** Palavras-chave (PT) para match com editais */
  palavras_chave?: string[];
  /** Palavras-chave em inglês (CNPq e editais internacionais) */
  palavras_chave_ingles?: string[];

  /** Título em inglês (opcional) */
  titulo_ingles?: string;

  /** Início previsto (AAAA-MM ou texto) e duração em meses */
  inicio_previsto?: string;
  duracao_meses?: string;

  /** Resumo executivo / abstract */
  resumo_executivo?: string;

  /** Problema / contexto */
  caracterizacao_problema?: string;

  objetivo_geral?: string;
  objetivos_especificos?: string;

  /** Metas e entregas (separado de objetivos — comum em CNPq DT) */
  metas?: string;

  /** Como será feito + gestão da execução */
  metodologia?: string;
  gestao_execucao?: string;

  /** Cronograma em texto livre */
  cronograma?: string;

  /** Resultados / entregas / impactos */
  resultados_esperados?: string;
  impactos?: string;

  /** Relevância para setor produtivo / demanda social (CNPq DT) */
  relevancia_setor_produtivo?: string;
  atendimento_demandas_produtivas_sociais?: string;

  /** Colaborações, fomento anterior, TRL / maturidade */
  instituicoes_colaboradoras?: string;
  financiamentos_anteriores?: string;
  maturidade_tecnologica?: string;

  /** Histórico e potencial de inovação */
  resultados_ja_alcancados?: string;
  potencial_producao_tecnologica?: string;
  potencial_empreendedorismo?: string;

  /** Súmula curricular (CNPq DT itens 11–12) */
  sumula_curricular?: string;
  sumula_curricular_continuacao?: string;

  /** Equipe e instituições (texto) */
  equipe?: string;
  instituicoes?: string;

  /** Orçamento estimado (texto ou valores) */
  orcamento_estimado?: string;

  /** Referências bibliográficas */
  referencias?: string;

  /**
   * Texto integral colado (PDF convertido / proposta antiga completa).
   * Usado na busca reversa e como base para adaptação futura a novos editais.
   */
  texto_completo?: string;
};

const STRING_KEYS: Array<keyof ProjetoConteudo> = [
  "titulo_ingles",
  "inicio_previsto",
  "duracao_meses",
  "resumo_executivo",
  "caracterizacao_problema",
  "objetivo_geral",
  "objetivos_especificos",
  "metas",
  "metodologia",
  "gestao_execucao",
  "cronograma",
  "resultados_esperados",
  "impactos",
  "relevancia_setor_produtivo",
  "atendimento_demandas_produtivas_sociais",
  "instituicoes_colaboradoras",
  "financiamentos_anteriores",
  "maturidade_tecnologica",
  "resultados_ja_alcancados",
  "potencial_producao_tecnologica",
  "potencial_empreendedorismo",
  "sumula_curricular",
  "sumula_curricular_continuacao",
  "equipe",
  "instituicoes",
  "orcamento_estimado",
  "referencias",
  "texto_completo",
];

function parseKeywords(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    return raw
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function createEmptyProjetoConteudo(): ProjetoConteudo {
  const empty: ProjetoConteudo = {
    origem: { tipo: null, descricao: "", ano: "" },
    palavras_chave: [],
    palavras_chave_ingles: [],
  };
  for (const key of STRING_KEYS) {
    empty[key] = "" as never;
  }
  return empty;
}

export function normalizeProjetoConteudo(raw: unknown): ProjetoConteudo {
  const base = createEmptyProjetoConteudo();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, any>;
  const origem = o.origem && typeof o.origem === "object" ? o.origem : {};
  const next: ProjetoConteudo = {
    ...base,
    origem: {
      tipo: (origem.tipo as ProjetoOrigemTipo | null) ?? null,
      descricao: String(origem.descricao ?? ""),
      ano: String(origem.ano ?? ""),
    },
    palavras_chave: parseKeywords(o.palavras_chave),
    palavras_chave_ingles: parseKeywords(o.palavras_chave_ingles),
  };
  for (const key of STRING_KEYS) {
    next[key] = String(o[key] ?? "") as never;
  }
  return next;
}

/** Texto plano para scoring / busca reversa. */
export function flattenProjetoConteudoForMatch(
  conteudo: unknown,
  meta?: {
    titulo?: string | null;
    resumo?: string | null;
    objetivos?: string | null;
    area?: string | null;
  },
): string {
  const c = normalizeProjetoConteudo(conteudo);
  return [
    meta?.titulo,
    meta?.resumo,
    meta?.objetivos,
    meta?.area,
    c.origem?.tipo,
    c.origem?.descricao,
    c.origem?.ano,
    c.titulo_ingles,
    ...(c.palavras_chave || []),
    ...(c.palavras_chave_ingles || []),
    c.inicio_previsto,
    c.duracao_meses,
    ...STRING_KEYS.map((k) => c[k]),
  ]
    .filter(Boolean)
    .join("\n");
}

export const PROJETO_ORIGEM_LABELS: Record<ProjetoOrigemTipo, string> = {
  proposta_anterior: "Proposta já enviada a outro edital",
  projeto_pesquisa: "Projeto / linha de pesquisa",
  ideia_nova: "Ideia nova para fomento",
  outro: "Outro",
};

/** UFs para a abrangência do projeto (coluna `projetos.abrangencia_ufs`). */
export const UF_LABELS: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

/** Texto curto da abrangência: "Nacional" ou "ES, RJ". */
export function formatAbrangencia(ufs: string[] | null | undefined): string {
  return ufs?.length ? ufs.join(", ") : "Nacional";
}

/** Seções de texto longo — rótulos alinhados à chamada CNPq DT (itens 1–12). */
export const PROJETO_SECTIONS: Array<{
  key: (typeof STRING_KEYS)[number];
  label: string;
  hint: string;
  rows?: number;
  charLimit?: number;
  group?: string;
}> = [
  {
    key: "resumo_executivo",
    label: "Resumo da proposta",
    hint: "Visão geral: objetivos, inovação, impacto e histórico (até ~1 página).",
    rows: 8,
    group: "Identificação",
  },
  {
    key: "caracterizacao_problema",
    label: "Problema / contexto",
    hint: "Contexto, gap científico/tecnológico/social e motivação (opcional além do resumo).",
    rows: 6,
    group: "Identificação",
  },
  {
    key: "objetivo_geral",
    label: "1. Objetivos (até 4.000 caracteres)",
    hint: "Objetivo geral e objetivos específicos do projeto (item 1 da chamada DT).",
    rows: 10,
    charLimit: 4000,
    group: "Sobre o projeto (CNPq DT)",
  },
  {
    key: "objetivos_especificos",
    label: "Objetivos específicos (detalhe)",
    hint: "Lista numerada complementar, se preferir separar do campo 1.",
    rows: 6,
    group: "Sobre o projeto (CNPq DT)",
  },
  {
    key: "metas",
    label: "2. Metas (até 4.000 caracteres)",
    hint: "Metas e entregas tecnológicas (INPI, escala, plataforma, etc.).",
    rows: 10,
    charLimit: 4000,
    group: "Sobre o projeto (CNPq DT)",
  },
  {
    key: "metodologia",
    label: "3. Metodologia e gestão da execução (até 4.000 caracteres)",
    hint: "Abordagem, procedimentos técnicos, processamento de dados e gestão (PI, TT, equipe).",
    rows: 12,
    charLimit: 4000,
    group: "Sobre o projeto (CNPq DT)",
  },
  {
    key: "gestao_execucao",
    label: "Gestão da execução (complemento)",
    hint: "Se quiser separar da metodologia: PI, transferência de tecnologia, infraestrutura.",
    rows: 6,
    group: "Sobre o projeto (CNPq DT)",
  },
  {
    key: "relevancia_setor_produtivo",
    label: "4. Relevância para o setor produtivo (até 4.000 caracteres)",
    hint: "Impacto em outorgas, obras, riscos, ESG, competitividade etc.",
    rows: 10,
    charLimit: 4000,
    group: "Sobre o projeto (CNPq DT)",
  },
  {
    key: "instituicoes_colaboradoras",
    label: "5. Instituições colaboradoras / financiadoras (até 4.000 caracteres)",
    hint: "Parceiros, empresas financiadoras e fomento anterior (órgãos, valores, bolsas).",
    rows: 8,
    charLimit: 4000,
    group: "Sobre o projeto (CNPq DT)",
  },
  {
    key: "financiamentos_anteriores",
    label: "Financiamentos anteriores (detalhe)",
    hint: "Complemento do item 5: valores, duração e bolsas já recebidas.",
    rows: 5,
    group: "Sobre o projeto (CNPq DT)",
  },
  {
    key: "maturidade_tecnologica",
    label: "6. Nível de maturidade tecnológica (até 4.000 caracteres)",
    hint: "TRL / estágio atual, validação e prontidão para transferência.",
    rows: 10,
    charLimit: 4000,
    group: "Sobre o projeto (CNPq DT)",
  },
  {
    key: "resultados_ja_alcancados",
    label: "7. Resultados científicos e tecnológicos já alcançados (até 4.000 caracteres)",
    hint: "Softwares, PI, publicações, implementação operacional, formação de RH.",
    rows: 10,
    charLimit: 4000,
    group: "Sobre o projeto (CNPq DT)",
  },
  {
    key: "potencial_producao_tecnologica",
    label: "8. Potencial para produção tecnológica e inovação (até 4.000 caracteres)",
    hint: "Novos ativos de PI, escalabilidade, Big Data, IA, TT.",
    rows: 10,
    charLimit: 4000,
    group: "Sobre o projeto (CNPq DT)",
  },
  {
    key: "potencial_empreendedorismo",
    label: "9. Potencial para empreendedorismo inovador (até 4.000 caracteres)",
    hint: "Licenciamento, know-how, spin-offs, ESG e ecossistema de inovação.",
    rows: 10,
    charLimit: 4000,
    group: "Sobre o projeto (CNPq DT)",
  },
  {
    key: "atendimento_demandas_produtivas_sociais",
    label: "10. Atendimento a necessidades do ambiente produtivo ou social (até 4.000 caracteres)",
    hint: "Como cria/melhora produtos, processos ou serviços demandados por instituições (item 6.6.1).",
    rows: 10,
    charLimit: 4000,
    group: "Sobre o projeto (CNPq DT)",
  },
  {
    key: "sumula_curricular",
    label: "11. Súmula curricular (até 4.000 caracteres)",
    hint: "Até 5 realizações acadêmicas de maior impacto (item 6.5 / Anexo I).",
    rows: 12,
    charLimit: 4000,
    group: "Súmula curricular (CNPq DT)",
  },
  {
    key: "sumula_curricular_continuacao",
    label: "12. Súmula curricular — continuação (até 4.000 caracteres)",
    hint: "Formação de RH, indicadores, financiamentos, prêmios e fechamento.",
    rows: 10,
    charLimit: 4000,
    group: "Súmula curricular (CNPq DT)",
  },
  {
    key: "cronograma",
    label: "Cronograma",
    hint: "Início, duração e etapas (texto livre).",
    rows: 5,
    group: "Complementos",
  },
  {
    key: "impactos",
    label: "Impactos esperados",
    hint: "Científico, tecnológico, econômico, social/ambiental (além dos itens DT).",
    rows: 6,
    group: "Complementos",
  },
  {
    key: "resultados_esperados",
    label: "Resultados e entregas previstos no período",
    hint: "O que será produzido / entregue no período da bolsa.",
    rows: 6,
    group: "Complementos",
  },
  {
    key: "equipe",
    label: "Equipe",
    hint: "Quem participa e papéis.",
    rows: 5,
    group: "Complementos",
  },
  {
    key: "instituicoes",
    label: "Instituição executora / sede",
    hint: "Ex.: Instituto Federal do Espírito Santo - Campus Colatina - IFES, ES, Brasil",
    rows: 4,
    group: "Complementos",
  },
  {
    key: "orcamento_estimado",
    label: "Orçamento estimado",
    hint: "Faixa de valor ou breakdown resumido.",
    rows: 4,
    group: "Complementos",
  },
  {
    key: "referencias",
    label: "Referências",
    hint: "Bibliografia principal.",
    rows: 6,
    group: "Complementos",
  },
  {
    key: "texto_completo",
    label: "Texto integral (colar proposta antiga)",
    hint: "Cole aqui o PDF/convertido completo se quiser guardar tudo de uma vez. Os campos numerados acima são preferíveis para match e candidatura.",
    rows: 16,
    group: "Anexo",
  },
];
