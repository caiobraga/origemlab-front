/**
 * Estrutura escrita de um Projeto (ativo reutilizável).
 * Não é só título/objetivo: é o texto que o pesquisador/empresa já tem —
 * proposta enviada a outro edital, projeto de pesquisa, pitch para fomento, etc.
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
    descricao?: string; // ex.: "Edital FAPESP 2024", "Projeto de doutorado"
    ano?: string;
  };

  /** Palavras-chave para match com editais */
  palavras_chave?: string[];

  /** Resumo executivo / abstract */
  resumo_executivo?: string;

  /** Problema / justificativa / contexto */
  caracterizacao_problema?: string;

  objetivo_geral?: string;
  objetivos_especificos?: string; // texto livre (lista numerada ok)

  /** Como será feito */
  metodologia?: string;

  /** Cronograma em texto livre */
  cronograma?: string;

  /** Resultados / entregas / impactos */
  resultados_esperados?: string;
  impactos?: string;

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

export function createEmptyProjetoConteudo(): ProjetoConteudo {
  return {
    origem: { tipo: null, descricao: "", ano: "" },
    palavras_chave: [],
    resumo_executivo: "",
    caracterizacao_problema: "",
    objetivo_geral: "",
    objetivos_especificos: "",
    metodologia: "",
    cronograma: "",
    resultados_esperados: "",
    impactos: "",
    equipe: "",
    instituicoes: "",
    orcamento_estimado: "",
    referencias: "",
    texto_completo: "",
  };
}

export function normalizeProjetoConteudo(raw: unknown): ProjetoConteudo {
  const base = createEmptyProjetoConteudo();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, any>;
  const origem = o.origem && typeof o.origem === "object" ? o.origem : {};
  return {
    ...base,
    origem: {
      tipo: (origem.tipo as ProjetoOrigemTipo | null) ?? null,
      descricao: String(origem.descricao ?? ""),
      ano: String(origem.ano ?? ""),
    },
    palavras_chave: Array.isArray(o.palavras_chave)
      ? o.palavras_chave.map(String).filter(Boolean)
      : typeof o.palavras_chave === "string"
        ? String(o.palavras_chave)
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    resumo_executivo: String(o.resumo_executivo ?? ""),
    caracterizacao_problema: String(o.caracterizacao_problema ?? ""),
    objetivo_geral: String(o.objetivo_geral ?? ""),
    objetivos_especificos: String(o.objetivos_especificos ?? ""),
    metodologia: String(o.metodologia ?? ""),
    cronograma: String(o.cronograma ?? ""),
    resultados_esperados: String(o.resultados_esperados ?? ""),
    impactos: String(o.impactos ?? ""),
    equipe: String(o.equipe ?? ""),
    instituicoes: String(o.instituicoes ?? ""),
    orcamento_estimado: String(o.orcamento_estimado ?? ""),
    referencias: String(o.referencias ?? ""),
    texto_completo: String(o.texto_completo ?? ""),
  };
}

/** Texto plano para scoring / busca reversa. */
export function flattenProjetoConteudoForMatch(conteudo: unknown, meta?: {
  titulo?: string | null;
  resumo?: string | null;
  objetivos?: string | null;
  area?: string | null;
}): string {
  const c = normalizeProjetoConteudo(conteudo);
  return [
    meta?.titulo,
    meta?.resumo,
    meta?.objetivos,
    meta?.area,
    c.origem?.tipo,
    c.origem?.descricao,
    c.origem?.ano,
    ...(c.palavras_chave || []),
    c.resumo_executivo,
    c.caracterizacao_problema,
    c.objetivo_geral,
    c.objetivos_especificos,
    c.metodologia,
    c.cronograma,
    c.resultados_esperados,
    c.impactos,
    c.equipe,
    c.instituicoes,
    c.orcamento_estimado,
    c.referencias,
    c.texto_completo,
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

export const PROJETO_SECTIONS: Array<{
  key: keyof ProjetoConteudo;
  label: string;
  hint: string;
  rows?: number;
}> = [
  {
    key: "resumo_executivo",
    label: "Resumo executivo",
    hint: "Visão geral do que o projeto faz e por que importa.",
    rows: 5,
  },
  {
    key: "caracterizacao_problema",
    label: "Problema e justificativa",
    hint: "Contexto, gap científico/tecnológico/social e motivação.",
    rows: 8,
  },
  {
    key: "objetivo_geral",
    label: "Objetivo geral",
    hint: "Uma frase clara do objetivo principal.",
    rows: 3,
  },
  {
    key: "objetivos_especificos",
    label: "Objetivos específicos",
    hint: "Lista numerada dos objetivos concretos.",
    rows: 6,
  },
  {
    key: "metodologia",
    label: "Metodologia / detalhamento",
    hint: "Como o trabalho será executado.",
    rows: 10,
  },
  {
    key: "cronograma",
    label: "Cronograma",
    hint: "Etapas e prazos (texto livre).",
    rows: 5,
  },
  {
    key: "resultados_esperados",
    label: "Resultados e entregas",
    hint: "O que será produzido / entregue.",
    rows: 6,
  },
  {
    key: "impactos",
    label: "Impactos esperados",
    hint: "Científico, tecnológico, econômico, social/ambiental.",
    rows: 6,
  },
  {
    key: "equipe",
    label: "Equipe",
    hint: "Quem participa e papéis.",
    rows: 5,
  },
  {
    key: "instituicoes",
    label: "Instituições",
    hint: "Executora, parceiras, vínculos.",
    rows: 4,
  },
  {
    key: "orcamento_estimado",
    label: "Orçamento estimado",
    hint: "Faixa de valor ou breakdown resumido.",
    rows: 4,
  },
  {
    key: "referencias",
    label: "Referências",
    hint: "Bibliografia principal.",
    rows: 6,
  },
  {
    key: "texto_completo",
    label: "Texto integral (colar proposta antiga)",
    hint: "Cole aqui o PDF/convertido ou a proposta completa já escrita. Isso alimenta a busca de editais e a adaptação futura.",
    rows: 16,
  },
];
