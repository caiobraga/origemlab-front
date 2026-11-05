import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  CNPQ_GRANDES_AREAS,
  type CnpqArea,
  type CnpqAreaAtuacao,
  type CnpqEspecialidade,
  type CnpqGrandeArea,
  type CnpqSubarea,
  cnpqSelectionKey,
  findCnpqGrandeArea,
  formatCnpqAreaAtuacao,
} from "@/lib/cnpqAreasConhecimento";
import { cn } from "@/lib/utils";

type Mode = "cnpq" | "custom";

type Props = {
  initial?: CnpqAreaAtuacao[];
  saving?: boolean;
  onComplete: (areas: CnpqAreaAtuacao[]) => void | Promise<void>;
};

function entryFromPath(opts: {
  grande: CnpqGrandeArea;
  area: CnpqArea;
  subarea?: CnpqSubarea;
  especialidade?: CnpqEspecialidade;
}): CnpqAreaAtuacao {
  const entry: CnpqAreaAtuacao = {
    grandeArea: { codigo: opts.grande.codigo, nome: opts.grande.nome },
    area: { codigo: opts.area.codigo, nome: opts.area.nome },
  };
  if (opts.subarea) {
    entry.subarea = { codigo: opts.subarea.codigo, nome: opts.subarea.nome };
  }
  if (opts.especialidade) {
    entry.especialidade = {
      codigo: opts.especialidade.codigo,
      nome: opts.especialidade.nome,
    };
  }
  return entry;
}

function matchesQuery(nome: string, q: string): boolean {
  if (!q) return true;
  return nome.toLowerCase().includes(q);
}

function TreeChevron({ open }: { open: boolean }) {
  return open ? (
    <ChevronDown className="w-4 h-4 shrink-0 text-gray-500" />
  ) : (
    <ChevronRight className="w-4 h-4 shrink-0 text-gray-500" />
  );
}

export default function CnpqAreasAtuacaoForm({ initial = [], saving = false, onComplete }: Props) {
  const [selected, setSelected] = useState<CnpqAreaAtuacao[]>(initial);
  const [mode, setMode] = useState<Mode>("cnpq");
  const [treeOpen, setTreeOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [openGrandes, setOpenGrandes] = useState<Record<string, boolean>>({});
  const [openAreas, setOpenAreas] = useState<Record<string, boolean>>({});
  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({});
  const [customLabel, setCustomLabel] = useState("");
  const [customGrandeCodigo, setCustomGrandeCodigo] = useState("");
  const [done, setDone] = useState(false);

  const selectedKeys = useMemo(
    () => new Set(selected.filter((s) => !s.custom).map(cnpqSelectionKey)),
    [selected],
  );

  const q = query.trim().toLowerCase();

  const filteredGrandes = useMemo(() => {
    if (!q) return CNPQ_GRANDES_AREAS;

    return CNPQ_GRANDES_AREAS.map((g) => {
      const grandeMatch = matchesQuery(g.nome, q);
      const areas = g.areas
        .map((a) => {
          const areaMatch = matchesQuery(a.nome, q);
          const subareas = a.subareas
            .map((s) => {
              const subMatch = matchesQuery(s.nome, q);
              const especialidades = subMatch
                ? s.especialidades
                : s.especialidades.filter((e) => matchesQuery(e.nome, q));
              if (!subMatch && especialidades.length === 0) return null;
              return { ...s, especialidades };
            })
            .filter(Boolean) as CnpqSubarea[];

          if (areaMatch) return a;
          if (subareas.length === 0) return null;
          return { ...a, subareas };
        })
        .filter(Boolean) as CnpqArea[];

      if (grandeMatch) return g;
      if (areas.length === 0) return null;
      return { ...g, areas };
    }).filter(Boolean) as CnpqGrandeArea[];
  }, [q]);

  // Auto-expand when searching
  const effectiveOpenGrande = (codigo: string) =>
    Boolean(q) || Boolean(openGrandes[codigo]);
  const effectiveOpenArea = (codigo: string) =>
    Boolean(q) || Boolean(openAreas[codigo]);
  const effectiveOpenSub = (codigo: string) =>
    Boolean(q) || Boolean(openSubs[codigo]);

  const toggleEntry = (entry: CnpqAreaAtuacao, checked: boolean) => {
    const key = cnpqSelectionKey(entry);
    setSelected((prev) => {
      if (checked) {
        if (prev.some((s) => cnpqSelectionKey(s) === key)) return prev;
        return [...prev, entry];
      }
      return prev.filter((s) => cnpqSelectionKey(s) !== key);
    });
  };

  const isChecked = (entry: CnpqAreaAtuacao) => selectedKeys.has(cnpqSelectionKey(entry));

  const canAddCustom = Boolean(customLabel.trim());

  const addCurrentCustom = () => {
    const label = customLabel.trim();
    if (!label) return;
    const refGrande = customGrandeCodigo ? findCnpqGrandeArea(customGrandeCodigo) : undefined;
    const entry: CnpqAreaAtuacao = {
      custom: true,
      customLabel: label,
      grandeArea: refGrande
        ? { codigo: refGrande.codigo, nome: refGrande.nome }
        : { codigo: "custom", nome: "Outra" },
      area: { codigo: "custom", nome: label },
    };
    const key = cnpqSelectionKey(entry);
    setSelected((prev) => {
      if (prev.some((s) => cnpqSelectionKey(s) === key)) return prev;
      return [...prev, entry];
    });
    setCustomLabel("");
    setCustomGrandeCodigo("");
  };

  const finish = async () => {
    if (selected.length === 0) return;
    await onComplete(selected);
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
        <span className="text-sm font-medium text-green-800">Áreas de atuação salvas.</span>
      </div>
    );
  }

  const cnpqSelectedCount = selected.filter((s) => !s.custom).length;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-gray-600">
          Escolha na tabela oficial do CNPq (grande área → área → subárea → especialidade) ou
          cadastre outra área não listada. Você pode adicionar <strong>várias</strong> áreas.
        </p>
        {selected.length > 0 && (
          <p className="text-sm text-primary font-medium">
            {selected.length} área{selected.length === 1 ? "" : "s"} selecionada
            {selected.length === 1 ? "" : "s"} — continue marcando ou finalize abaixo.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("cnpq")}
          className={`p-3 border rounded-sm text-sm font-medium transition-colors ${
            mode === "cnpq"
              ? "border-primary bg-secondary text-primary"
              : "border-gray-200 hover:border-primary"
          }`}
        >
          Tabela CNPq
        </button>
        <button
          type="button"
          onClick={() => setMode("custom")}
          className={`p-3 border rounded-sm text-sm font-medium transition-colors ${
            mode === "custom"
              ? "border-primary bg-secondary text-primary"
              : "border-gray-200 hover:border-primary"
          }`}
        >
          Outra área
        </button>
      </div>

      {mode === "cnpq" ? (
        <div className="space-y-2">
          <Label>Áreas do conhecimento (CNPq)</Label>
          <Collapsible open={treeOpen} onOpenChange={setTreeOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex h-11 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm hover:border-primary"
              >
                <span className="truncate text-left text-gray-700">
                  {cnpqSelectedCount > 0
                    ? `${cnpqSelectedCount} área${cnpqSelectedCount === 1 ? "" : "s"} marcada${cnpqSelectedCount === 1 ? "" : "s"}`
                    : "Abrir lista — marque uma ou mais áreas"}
                </span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 shrink-0 text-gray-500 transition-transform",
                    treeOpen && "rotate-180",
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 rounded-md border border-border bg-white">
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar área, subárea ou especialidade..."
                      className="h-10 pl-9"
                    />
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto p-1">
                  {filteredGrandes.length === 0 ? (
                    <p className="p-3 text-sm text-gray-500">Nenhum resultado para “{query}”.</p>
                  ) : (
                    filteredGrandes.map((grande) => {
                      const gOpen = effectiveOpenGrande(grande.codigo);
                      return (
                        <div key={grande.codigo} className="border-b border-border/60 last:border-0">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-2 py-2.5 text-left text-sm font-semibold text-gray-900 hover:bg-secondary/50"
                            onClick={() =>
                              setOpenGrandes((prev) => ({
                                ...prev,
                                [grande.codigo]: !prev[grande.codigo],
                              }))
                            }
                          >
                            <TreeChevron open={gOpen} />
                            <span>{grande.nome}</span>
                          </button>
                          {gOpen &&
                            grande.areas.map((area) => {
                              const areaKey = `${grande.codigo}:${area.codigo}`;
                              const aOpen = effectiveOpenArea(areaKey);
                              const areaEntry = entryFromPath({ grande, area });
                              const hasChildren = (area.subareas?.length || 0) > 0;
                              return (
                                <div key={area.codigo} className="ml-3 border-l border-border/80">
                                  <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-secondary/40">
                                    {hasChildren ? (
                                      <button
                                        type="button"
                                        className="shrink-0"
                                        aria-label={aOpen ? "Recolher" : "Expandir"}
                                        onClick={() =>
                                          setOpenAreas((prev) => ({
                                            ...prev,
                                            [areaKey]: !prev[areaKey],
                                          }))
                                        }
                                      >
                                        <TreeChevron open={aOpen} />
                                      </button>
                                    ) : (
                                      <span className="w-4" />
                                    )}
                                    <Checkbox
                                      checked={isChecked(areaEntry)}
                                      onCheckedChange={(v) =>
                                        toggleEntry(areaEntry, v === true)
                                      }
                                      id={`area-${area.codigo}`}
                                    />
                                    <label
                                      htmlFor={`area-${area.codigo}`}
                                      className="text-sm text-gray-800 cursor-pointer flex-1"
                                    >
                                      {area.nome}
                                    </label>
                                  </div>
                                  {aOpen &&
                                    area.subareas.map((sub) => {
                                      const subKey = `${areaKey}:${sub.codigo}`;
                                      const sOpen = effectiveOpenSub(subKey);
                                      const subEntry = entryFromPath({
                                        grande,
                                        area,
                                        subarea: sub,
                                      });
                                      const hasEsp = (sub.especialidades?.length || 0) > 0;
                                      return (
                                        <div
                                          key={sub.codigo}
                                          className="ml-4 border-l border-border/60"
                                        >
                                          <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-secondary/40">
                                            {hasEsp ? (
                                              <button
                                                type="button"
                                                className="shrink-0"
                                                aria-label={sOpen ? "Recolher" : "Expandir"}
                                                onClick={() =>
                                                  setOpenSubs((prev) => ({
                                                    ...prev,
                                                    [subKey]: !prev[subKey],
                                                  }))
                                                }
                                              >
                                                <TreeChevron open={sOpen} />
                                              </button>
                                            ) : (
                                              <span className="w-4" />
                                            )}
                                            <Checkbox
                                              checked={isChecked(subEntry)}
                                              onCheckedChange={(v) =>
                                                toggleEntry(subEntry, v === true)
                                              }
                                              id={`sub-${sub.codigo}`}
                                            />
                                            <label
                                              htmlFor={`sub-${sub.codigo}`}
                                              className="text-sm text-gray-700 cursor-pointer flex-1"
                                            >
                                              {sub.nome}
                                            </label>
                                          </div>
                                          {sOpen &&
                                            sub.especialidades.map((esp) => {
                                              const espEntry = entryFromPath({
                                                grande,
                                                area,
                                                subarea: sub,
                                                especialidade: esp,
                                              });
                                              return (
                                                <div
                                                  key={esp.codigo}
                                                  className="ml-6 flex items-center gap-2 px-2 py-1.5 hover:bg-secondary/40"
                                                >
                                                  <span className="w-4" />
                                                  <Checkbox
                                                    checked={isChecked(espEntry)}
                                                    onCheckedChange={(v) =>
                                                      toggleEntry(espEntry, v === true)
                                                    }
                                                    id={`esp-${esp.codigo}`}
                                                  />
                                                  <label
                                                    htmlFor={`esp-${esp.codigo}`}
                                                    className="text-sm text-gray-600 cursor-pointer flex-1"
                                                  >
                                                    {esp.nome}
                                                  </label>
                                                </div>
                                              );
                                            })}
                                        </div>
                                      );
                                    })}
                                </div>
                              );
                            })}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cnpq-custom-label">Nome da área</Label>
            <Input
              id="cnpq-custom-label"
              placeholder="Ex.: Bioinformática, Direito Sanitário..."
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cnpq-custom-grande">Grande área de referência (opcional)</Label>
            <select
              id="cnpq-custom-grande"
              className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={customGrandeCodigo}
              onChange={(e) => setCustomGrandeCodigo(e.target.value)}
            >
              <option value="">Não informar</option>
              {CNPQ_GRANDES_AREAS.map((g) => (
                <option key={g.codigo} value={g.codigo}>
                  {g.nome}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={!canAddCustom || saving}
            onClick={addCurrentCustom}
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar outra área
          </Button>
        </div>
      )}

      {selected.length > 0 && (
        <div className="space-y-2">
          <Label>Áreas selecionadas</Label>
          <ul className="space-y-2 border border-border rounded-sm p-3 bg-secondary/30">
            {selected.map((item) => {
              const key = cnpqSelectionKey(item);
              return (
                <li key={key} className="flex items-start justify-between gap-2 text-sm text-gray-800">
                  <span>
                    {item.custom ? (
                      <>
                        <span className="text-xs font-medium text-primary mr-1.5">Outra</span>
                        {formatCnpqAreaAtuacao(item)}
                      </>
                    ) : (
                      formatCnpqAreaAtuacao(item)
                    )}
                  </span>
                  <button
                    type="button"
                    className="text-gray-500 hover:text-red-600 shrink-0"
                    aria-label="Remover"
                    onClick={() =>
                      setSelected((prev) => prev.filter((s) => cnpqSelectionKey(s) !== key))
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Button
        className="w-full"
        disabled={selected.length === 0 || saving}
        onClick={() => void finish()}
      >
        {saving ? "Salvando..." : "Continuar"}
        <ArrowRight className="w-5 h-5 ml-2" />
      </Button>
      {selected.length === 0 && (
        <p className="text-sm text-amber-700">Adicione ao menos uma área de atuação para continuar.</p>
      )}
    </div>
  );
}
