/**
 * Conversão entre Proposta (candidatura a um edital) e Projeto (ativo reutilizável).
 * Mapeamento estrutural — sem IA. Campos sem equivalente ficam no texto_completo / campos extras.
 */

import {
  createEmptyProjetoConteudo,
  normalizeProjetoConteudo,
  type ProjetoConteudo,
} from "./projetoFormFields";
import { createEmptyPropostaForm, type PropostaFormData } from "./propostaFormFields";
import { createEmptyCNPqForm, type CNPqFormData } from "./cnpqFormFields";
import type { Projeto } from "./projetosApi";
import type { Proposta } from "./propostasApi";

function asRecord(v: unknown): Record<string, any> {
  return v && typeof v === "object" ? (v as Record<string, any>) : {};
}

function joinLines(...parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (p == null ? "" : String(p).trim()))
    .filter(Boolean)
    .join("\n\n");
}

function objetivosEspecificosToText(list: unknown): string {
  if (!Array.isArray(list) || list.length === 0) return "";
  return list
    .map((item, i) => {
      const o = asRecord(item);
      const desc = String(o.descricao || "").trim();
      const entregas = Array.isArray(o.entregas) ? o.entregas.filter(Boolean).join("; ") : "";
      const linha = desc || "(sem descrição)";
      return entregas ? `${i + 1}. ${linha}\n   Entregas: ${entregas}` : `${i + 1}. ${linha}`;
    })
    .join("\n");
}

function equipeToText(list: unknown): string {
  if (!Array.isArray(list) || list.length === 0) return "";
  return list
    .map((item) => {
      const o = asRecord(item);
      const bits = [o.nome, o.funcao, o.instituicao_vinculo, o.responsabilidades]
        .map((x) => String(x || "").trim())
        .filter(Boolean);
      return bits.join(" — ");
    })
    .filter(Boolean)
    .join("\n");
}

function impactosToText(imp: unknown): string {
  const o = asRecord(imp);
  return joinLines(
    o.impacto_cientifico ? `Científico:\n${o.impacto_cientifico}` : "",
    o.impacto_tecnologico ? `Tecnológico:\n${o.impacto_tecnologico}` : "",
    o.impacto_economico ? `Econômico:\n${o.impacto_economico}` : "",
    o.impacto_social_ambiental ? `Social/ambiental:\n${o.impacto_social_ambiental}` : "",
  );
}

function flattenPropostaForTextoCompleto(campos: Record<string, any>): string {
  const d = asRecord(campos.detalhamento_projeto);
  const inst = asRecord(campos.instituicao_executora);
  const coord = asRecord(campos.coordenador_projeto);
  return joinLines(
    campos.titulo_projeto ? `Título: ${campos.titulo_projeto}` : "",
    d.titulo && d.titulo !== campos.titulo_projeto ? `Título (detalhamento): ${d.titulo}` : "",
    d.resumo_publicavel ? `Resumo:\n${d.resumo_publicavel}` : "",
    d.caracterizacao_problema ? `Problema:\n${d.caracterizacao_problema}` : "",
    d.objetivo_geral ? `Objetivo geral:\n${d.objetivo_geral}` : "",
    objetivosEspecificosToText(d.objetivos_especificos)
      ? `Objetivos específicos:\n${objetivosEspecificosToText(d.objetivos_especificos)}`
      : "",
    d.detalhamento_projeto ? `Metodologia / detalhamento:\n${d.detalhamento_projeto}` : "",
    d.beneficios_resultados_esperados
      ? `Resultados esperados:\n${d.beneficios_resultados_esperados}`
      : "",
    impactosToText(d.impactos_esperados) ? `Impactos:\n${impactosToText(d.impactos_esperados)}` : "",
    d.qualificacao_equipe ? `Qualificação da equipe:\n${d.qualificacao_equipe}` : "",
    equipeToText(campos.equipe_projeto) ? `Equipe:\n${equipeToText(campos.equipe_projeto)}` : "",
    inst.nome ? `Instituição: ${[inst.nome, inst.sigla].filter(Boolean).join(" / ")}` : "",
    coord.nome ? `Coordenador: ${coord.nome}` : "",
    d.valor_projeto ? `Valor: ${d.valor_projeto}` : "",
    d.referencias ? `Referências:\n${d.referencias}` : "",
  );
}

export type ProjetoCreateFromProposta = {
  titulo: string;
  resumo: string | null;
  objetivos: string | null;
  area: string | null;
  conteudo: ProjetoConteudo;
};

/** Extrai um Projeto reutilizável a partir dos campos de uma Proposta. */
export function propostaToProjetoInput(
  proposta: Pick<Proposta, "id" | "campos_formulario" | "edital_titulo" | "edital_orgao" | "edital_fonte">,
  opts?: { area?: string | null },
): ProjetoCreateFromProposta {
  const campos = asRecord(proposta.campos_formulario);

  // Formulário CNPq (estrutura diferente)
  if (campos.projeto_pesquisa || campos.sobre_projeto) {
    const pp = asRecord(campos.projeto_pesquisa);
    const resumo = asRecord(campos.resumo);
    const sp = asRecord(campos.sobre_projeto);
    const titulo =
      String(pp.titulo_projeto_pt || proposta.edital_titulo || "Projeto a partir de proposta").trim() ||
      "Projeto a partir de proposta";
    const conteudo = createEmptyProjetoConteudo();
    conteudo.origem = {
      tipo: "proposta_anterior",
      descricao: [proposta.edital_titulo, proposta.edital_orgao || proposta.edital_fonte || "CNPq"]
        .filter(Boolean)
        .join(" — "),
      ano: String(new Date().getFullYear()),
    };
    (conteudo as any).origem_proposta_id = proposta.id;
    conteudo.titulo_ingles = String(pp.titulo_projeto_en || "").trim();
    conteudo.palavras_chave = String(pp.palavras_chave_pt || "")
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
    conteudo.palavras_chave_ingles = String(pp.palavras_chave_en || "")
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
    conteudo.resumo_executivo = String(resumo.resumo_proposta || "").trim();
    conteudo.objetivo_geral = String(sp.objetivo || "").trim();
    conteudo.metas = String(sp.metas || "").trim();
    conteudo.metodologia = String(sp.metodologia_gestao_execucao || "").trim();
    conteudo.relevancia_setor_produtivo = String(sp.relevancia_setor_produtivo || "").trim();
    conteudo.instituicoes_colaboradoras = String(sp.instituicoes_colaboradoras_financiadoras || "").trim();
    conteudo.financiamentos_anteriores = String(sp.instituicoes_colaboradoras_financiadoras || "").trim();
    conteudo.maturidade_tecnologica = String(sp.nivel_maturidade_tecnologica || "").trim();
    conteudo.resultados_ja_alcancados = String(sp.resultados_cientificos_tecnologicos || "").trim();
    conteudo.potencial_producao_tecnologica = String(
      sp.potencial_producao_tecnologica_inovacao || "",
    ).trim();
    conteudo.potencial_empreendedorismo = String(sp.potencial_empreendedorismo_inovador || "").trim();
    conteudo.atendimento_demandas_produtivas_sociais = String(
      sp.potencial_atendimento_necessidades || "",
    ).trim();
    conteudo.sumula_curricular = String(sp.sumula_curricular || "").trim();
    conteudo.sumula_curricular_continuacao = String(sp.sumula_curricular_continuacao || "").trim();
    conteudo.instituicoes = String(pp.instituicao_desenvolvimento || "").trim();
    conteudo.texto_completo = joinLines(
      pp.titulo_projeto_pt ? `Título: ${pp.titulo_projeto_pt}` : "",
      pp.titulo_projeto_en ? `Título (EN): ${pp.titulo_projeto_en}` : "",
      resumo.resumo_proposta ? `Resumo:\n${resumo.resumo_proposta}` : "",
      sp.objetivo ? `Objetivo:\n${sp.objetivo}` : "",
      sp.metas ? `Metas:\n${sp.metas}` : "",
      sp.metodologia_gestao_execucao ? `Metodologia:\n${sp.metodologia_gestao_execucao}` : "",
      sp.relevancia_setor_produtivo
        ? `Relevância setor produtivo:\n${sp.relevancia_setor_produtivo}`
        : "",
      sp.nivel_maturidade_tecnologica
        ? `Maturidade tecnológica:\n${sp.nivel_maturidade_tecnologica}`
        : "",
      sp.resultados_cientificos_tecnologicos
        ? `Resultados já alcançados:\n${sp.resultados_cientificos_tecnologicos}`
        : "",
      sp.potencial_producao_tecnologica_inovacao
        ? `Potencial tecnológico:\n${sp.potencial_producao_tecnologica_inovacao}`
        : "",
      sp.potencial_empreendedorismo_inovador
        ? `Empreendedorismo:\n${sp.potencial_empreendedorismo_inovador}`
        : "",
      sp.potencial_atendimento_necessidades
        ? `Atendimento a demandas:\n${sp.potencial_atendimento_necessidades}`
        : "",
      sp.sumula_curricular ? `Súmula:\n${sp.sumula_curricular}` : "",
      sp.sumula_curricular_continuacao
        ? `Súmula (cont.):\n${sp.sumula_curricular_continuacao}`
        : "",
    );
    return {
      titulo,
      resumo: conteudo.resumo_executivo || null,
      objetivos: conteudo.objetivo_geral || null,
      area: opts?.area ?? (String(pp.area || "").trim() || null),
      conteudo,
    };
  }

  const d = asRecord(campos.detalhamento_projeto);
  const inst = asRecord(campos.instituicao_executora);

  const titulo =
    String(campos.titulo_projeto || d.titulo || proposta.edital_titulo || "Projeto a partir de proposta").trim() ||
    "Projeto a partir de proposta";

  const conteudo = createEmptyProjetoConteudo();
  conteudo.origem = {
    tipo: "proposta_anterior",
    descricao: [proposta.edital_titulo, proposta.edital_orgao || proposta.edital_fonte]
      .filter(Boolean)
      .join(" — "),
    ano: String(new Date().getFullYear()),
  };
  (conteudo as any).origem_proposta_id = proposta.id;

  conteudo.palavras_chave = Array.isArray(d.palavras_chave)
    ? d.palavras_chave.map(String).filter(Boolean).slice(0, 12)
    : [];
  conteudo.resumo_executivo = String(d.resumo_publicavel || "").trim();
  conteudo.caracterizacao_problema = String(d.caracterizacao_problema || "").trim();
  conteudo.objetivo_geral = String(d.objetivo_geral || "").trim();
  conteudo.objetivos_especificos = objetivosEspecificosToText(d.objetivos_especificos);
  conteudo.metodologia = joinLines(
    d.detalhamento_projeto,
    d.descricao_avancao_cti,
    d.caracterizacao_interdisciplinaridade,
  );
  conteudo.gestao_execucao = String(d.qualificacao_equipe || "").trim()
    ? `Qualificação da equipe:\n${d.qualificacao_equipe}`
    : "";
  conteudo.resultados_esperados = String(d.beneficios_resultados_esperados || "").trim();
  conteudo.impactos = impactosToText(d.impactos_esperados);
  conteudo.relevancia_setor_produtivo = String(d.potencial_fortalecimento_linha_pesquisa || "").trim();
  conteudo.maturidade_tecnologica = String(d.caracterizacao_contribuicao_inovacao || "").trim();
  conteudo.equipe = joinLines(d.qualificacao_equipe, equipeToText(campos.equipe_projeto));
  conteudo.instituicoes = [inst.nome, inst.sigla, inst.municipio].filter(Boolean).join(" — ");
  conteudo.financiamentos_anteriores = d.possui_outras_fontes_fomento
    ? String(d.outras_fontes_fomento || "").trim()
    : "";
  conteudo.orcamento_estimado = String(d.valor_projeto || "").trim();
  if (d.duracao_meses != null && d.duracao_meses !== "") {
    conteudo.duracao_meses = String(d.duracao_meses);
  }
  conteudo.referencias = String(d.referencias || "").trim();
  conteudo.texto_completo = flattenPropostaForTextoCompleto(campos);

  return {
    titulo,
    resumo: conteudo.resumo_executivo || null,
    objetivos: conteudo.objetivo_geral || null,
    area: opts?.area ?? null,
    conteudo,
  };
}

function textToObjetivosEspecificos(text: string): PropostaFormData["detalhamento_projeto"]["objetivos_especificos"] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*\d+[\).\-\s]+/, "").trim())
    .filter(Boolean);
  if (!lines.length) return [];
  return lines.map((descricao) => ({
    descricao,
    entregas: [],
    criterios_aceitacao: "",
    responsaveis: [],
    cronograma: {},
  }));
}

/** Prefill do formulário CNPq DT a partir de um Projeto (campos 1:1 quando existem). */
export function projetoToCNPqCampos(projeto: Projeto): CNPqFormData {
  const c = normalizeProjetoConteudo(projeto.conteudo);
  const form = createEmptyCNPqForm();
  form.projeto_pesquisa.titulo_projeto_pt = projeto.titulo || "";
  form.projeto_pesquisa.titulo_projeto_en = c.titulo_ingles || "";
  form.projeto_pesquisa.area = String(projeto.area || "").trim();
  form.projeto_pesquisa.instituicao_desenvolvimento = c.instituicoes || "";
  form.projeto_pesquisa.palavras_chave_pt = (c.palavras_chave || []).join("; ");
  form.projeto_pesquisa.palavras_chave_en = (c.palavras_chave_ingles || []).join("; ");
  form.resumo.resumo_proposta = (c.resumo_executivo || String(projeto.resumo || "")).slice(0, 2000);
  form.sobre_projeto.objetivo = joinLines(c.objetivo_geral, c.objetivos_especificos).slice(0, 4000);
  form.sobre_projeto.metas = (c.metas || "").slice(0, 4000);
  form.sobre_projeto.metodologia_gestao_execucao = joinLines(
    c.metodologia,
    c.gestao_execucao,
  ).slice(0, 4000);
  form.sobre_projeto.relevancia_setor_produtivo = (c.relevancia_setor_produtivo || "").slice(0, 4000);
  form.sobre_projeto.instituicoes_colaboradoras_financiadoras = joinLines(
    c.instituicoes_colaboradoras,
    c.financiamentos_anteriores,
  ).slice(0, 4000);
  form.sobre_projeto.nivel_maturidade_tecnologica = (c.maturidade_tecnologica || "").slice(0, 4000);
  form.sobre_projeto.resultados_cientificos_tecnologicos = (
    c.resultados_ja_alcancados ||
    c.resultados_esperados ||
    ""
  ).slice(0, 4000);
  form.sobre_projeto.potencial_producao_tecnologica_inovacao = (
    c.potencial_producao_tecnologica || ""
  ).slice(0, 4000);
  form.sobre_projeto.potencial_empreendedorismo_inovador = (
    c.potencial_empreendedorismo || ""
  ).slice(0, 4000);
  form.sobre_projeto.potencial_atendimento_necessidades = (
    c.atendimento_demandas_produtivas_sociais || ""
  ).slice(0, 4000);
  form.sobre_projeto.sumula_curricular = (c.sumula_curricular || "").slice(0, 4000);
  form.sobre_projeto.sumula_curricular_continuacao = (
    c.sumula_curricular_continuacao || ""
  ).slice(0, 4000);
  return form;
}

/** Prefill do formulário de proposta a partir de um Projeto salvo. */
export function projetoToPropostaCampos(projeto: Projeto): PropostaFormData {
  const c = normalizeProjetoConteudo(projeto.conteudo);
  const form = createEmptyPropostaForm();

  form.titulo_projeto = projeto.titulo || "";
  form.detalhamento_projeto.titulo = projeto.titulo || "";
  form.detalhamento_projeto.resumo_publicavel =
    c.resumo_executivo || String(projeto.resumo || "") || "";
  form.detalhamento_projeto.palavras_chave = (c.palavras_chave || []).slice(0, 6);
  form.detalhamento_projeto.caracterizacao_problema = c.caracterizacao_problema || "";
  form.detalhamento_projeto.objetivo_geral =
    c.objetivo_geral || String(projeto.objetivos || "") || "";
  form.detalhamento_projeto.objetivos_especificos = textToObjetivosEspecificos(
    c.objetivos_especificos || "",
  );
  form.detalhamento_projeto.detalhamento_projeto = joinLines(
    c.metodologia,
    c.gestao_execucao,
    c.metas ? `Metas:\n${c.metas}` : "",
    c.texto_completo,
  );
  form.detalhamento_projeto.beneficios_resultados_esperados = joinLines(
    c.resultados_esperados,
    c.resultados_ja_alcancados ? `Já alcançados:\n${c.resultados_ja_alcancados}` : "",
  );
  form.detalhamento_projeto.impactos_esperados = {
    impacto_cientifico: c.impactos || "",
    impacto_tecnologico: c.potencial_producao_tecnologica || "",
    impacto_economico: c.relevancia_setor_produtivo || "",
    impacto_social_ambiental: c.atendimento_demandas_produtivas_sociais || "",
  };
  form.detalhamento_projeto.qualificacao_equipe = c.equipe || "";
  form.detalhamento_projeto.caracterizacao_contribuicao_inovacao = joinLines(
    c.maturidade_tecnologica,
    c.potencial_empreendedorismo,
  );
  form.detalhamento_projeto.potencial_fortalecimento_linha_pesquisa =
    c.relevancia_setor_produtivo || "";
  form.detalhamento_projeto.referencias = c.referencias || "";
  form.detalhamento_projeto.valor_projeto = c.orcamento_estimado || "";
  const duracao = parseInt(String(c.duracao_meses || "").replace(/\D/g, ""), 10);
  if (Number.isFinite(duracao) && duracao > 0) {
    form.detalhamento_projeto.duracao_meses = duracao;
  }
  if (c.financiamentos_anteriores) {
    form.detalhamento_projeto.possui_outras_fontes_fomento = true;
    form.detalhamento_projeto.outras_fontes_fomento = c.financiamentos_anteriores;
  }
  if (c.instituicoes) {
    form.instituicao_executora.nome = c.instituicoes.split("—")[0]?.trim() || c.instituicoes;
  }

  return form;
}
