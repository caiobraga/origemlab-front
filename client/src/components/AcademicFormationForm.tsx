import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { CurriculumData } from "@/lib/userProfile";
import type { LattesData } from "@/lib/externalAPIs";
import {
  ACADEMIC_LEVELS,
  type AcademicFormationEntry,
  type AcademicLevel,
  buildCurriculumFromFormacao,
  isFormationEntryComplete,
  shouldAskMestradoFollowUp,
} from "@/lib/academicFormation";

type WizardPhase =
  | "highest"
  | "highest-details"
  | "mestrado"
  | "add-more?"
  | "extra-level"
  | "extra-details"
  | "done";

type DraftEntry = {
  nivel: string;
  curso: string;
  instituicao: string;
  anoConclusao: string;
  emAndamento: boolean;
};

const emptyDraft = (nivel = ""): DraftEntry => ({
  nivel,
  curso: "",
  instituicao: "",
  anoConclusao: "",
  emAndamento: false,
});

function draftToEntry(d: DraftEntry): AcademicFormationEntry {
  return {
    nivel: d.nivel.trim(),
    curso: d.curso.trim(),
    instituicao: d.instituicao.trim(),
    anoConclusao: d.emAndamento ? undefined : d.anoConclusao.trim() || undefined,
    emAndamento: d.emAndamento || undefined,
  };
}

function FormationFields({
  draft,
  onChange,
  title,
  subtitle,
}: {
  draft: DraftEntry;
  onChange: (next: DraftEntry) => void;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-gray-900 font-medium">{title}</p>
        {subtitle ? <p className="text-sm text-gray-600 mt-1">{subtitle}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="af-curso">Área / curso</Label>
        <Input
          id="af-curso"
          placeholder="Ex.: Ciência da Computação"
          value={draft.curso}
          onChange={(e) => onChange({ ...draft, curso: e.target.value })}
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="af-instituicao">Universidade / instituição</Label>
        <Input
          id="af-instituicao"
          placeholder="Ex.: USP"
          value={draft.instituicao}
          onChange={(e) => onChange({ ...draft, instituicao: e.target.value })}
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="af-ano">Ano de conclusão</Label>
        <Input
          id="af-ano"
          inputMode="numeric"
          placeholder="Ex.: 2019"
          value={draft.anoConclusao}
          disabled={draft.emAndamento}
          onChange={(e) =>
            onChange({
              ...draft,
              anoConclusao: e.target.value.replace(/\D/g, "").slice(0, 4),
            })
          }
          className="h-11"
          maxLength={4}
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.emAndamento}
            onChange={(e) =>
              onChange({
                ...draft,
                emAndamento: e.target.checked,
                anoConclusao: e.target.checked ? "" : draft.anoConclusao,
              })
            }
            className="rounded border-gray-300"
          />
          Ainda em andamento
        </label>
      </div>
    </div>
  );
}

type Props = {
  onComplete: (data: CurriculumData) => void | Promise<void>;
  existing?: CurriculumData | LattesData | null;
  saving?: boolean;
};

export default function AcademicFormationForm({
  onComplete,
  existing,
  saving = false,
}: Props) {
  const [phase, setPhase] = useState<WizardPhase>("highest");
  const [highestLevel, setHighestLevel] = useState<AcademicLevel | "">("");
  const [entries, setEntries] = useState<AcademicFormationEntry[]>([]);
  const [draft, setDraft] = useState<DraftEntry>(emptyDraft());
  const [extraLevel, setExtraLevel] = useState<AcademicLevel | "">("");

  const finish = async (list: AcademicFormationEntry[]) => {
    const curriculum = buildCurriculumFromFormacao(list, { existing });
    await onComplete(curriculum);
    setPhase("done");
  };

  if (phase === "done") {
    return (
      <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
        <span className="text-sm font-medium text-green-800">Formação acadêmica salva.</span>
      </div>
    );
  }

  if (phase === "highest") {
    return (
      <div className="space-y-4">
        <p className="text-gray-600">Qual o maior nível de formação acadêmica que você possui?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ACADEMIC_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => {
                setHighestLevel(level);
                setDraft(emptyDraft(level));
                setPhase("highest-details");
              }}
              className={`p-4 border rounded-sm text-left font-medium transition-colors ${
                highestLevel === level
                  ? "border-primary bg-secondary text-primary"
                  : "border-gray-200 hover:border-primary"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "highest-details") {
    return (
      <div className="space-y-6">
        <FormationFields
          draft={draft}
          onChange={setDraft}
          title={draft.nivel}
          subtitle="Em qual área, universidade e ano?"
        />
        <Button
          className="w-full"
          disabled={!isFormationEntryComplete(draft) || saving}
          onClick={() => {
            if (!isFormationEntryComplete(draft)) return;
            const entry = draftToEntry(draft);
            setEntries((prev) => [...prev, entry]);
            if (shouldAskMestradoFollowUp(draft.nivel)) {
              setDraft(emptyDraft("Mestrado"));
              setPhase("mestrado");
            } else {
              setDraft(emptyDraft());
              setPhase("add-more?");
            }
          }}
        >
          Continuar <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  if (phase === "mestrado") {
    return (
      <div className="space-y-6">
        <FormationFields
          draft={draft}
          onChange={(d) => setDraft({ ...d, nivel: "Mestrado" })}
          title="Seu mestrado"
          subtitle="Informe área, ano e instituição do mestrado."
        />
        <Button
          className="w-full"
          disabled={!isFormationEntryComplete({ ...draft, nivel: "Mestrado" }) || saving}
          onClick={() => {
            const mestrado = draftToEntry({ ...draft, nivel: "Mestrado" });
            if (!isFormationEntryComplete(mestrado)) return;
            setEntries((prev) => {
              const next = [...prev, mestrado];
              return next;
            });
            setDraft(emptyDraft());
            setPhase("add-more?");
          }}
        >
          Continuar <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  if (phase === "add-more?") {
    return (
      <div className="space-y-4">
        <p className="text-gray-600">
          Deseja adicionar alguma outra informação relacionada à sua formação acadêmica?
        </p>
        {entries.length > 0 && (
          <ul className="text-sm text-gray-700 space-y-1 border border-border rounded-sm p-3 bg-secondary/30">
            {entries.map((e, i) => (
              <li key={i}>
                <span className="font-medium">{e.nivel}</span> — {e.curso} ({e.instituicao}
                {e.anoConclusao ? `, ${e.anoConclusao}` : e.emAndamento ? ", em andamento" : ""})
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="w-full"
            disabled={saving}
            onClick={() => {
              setExtraLevel("");
              setPhase("extra-level");
            }}
          >
            Sim
          </Button>
          <Button
            className="w-full"
            disabled={saving || entries.length === 0}
            onClick={() => void finish(entries)}
          >
            {saving ? "Salvando..." : "Não, finalizar"}
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "extra-level") {
    return (
      <div className="space-y-4">
        <p className="text-gray-600">Qual formação deseja adicionar?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ACADEMIC_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => {
                setExtraLevel(level);
                setDraft(emptyDraft(level));
                setPhase("extra-details");
              }}
              className={`p-4 border rounded-sm text-left font-medium transition-colors ${
                extraLevel === level
                  ? "border-primary bg-secondary text-primary"
                  : "border-gray-200 hover:border-primary"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
        <Button variant="ghost" className="w-full" onClick={() => setPhase("add-more?")}>
          Voltar
        </Button>
      </div>
    );
  }

  if (phase === "extra-details") {
    return (
      <div className="space-y-6">
        <FormationFields
          draft={draft}
          onChange={setDraft}
          title={draft.nivel || "Formação"}
          subtitle="Área, universidade e ano."
        />
        <Button
          className="w-full"
          disabled={!isFormationEntryComplete(draft) || saving}
          onClick={() => {
            if (!isFormationEntryComplete(draft)) return;
            setEntries((prev) => [...prev, draftToEntry(draft)]);
            setDraft(emptyDraft());
            setPhase("add-more?");
          }}
        >
          Adicionar <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  return null;
}
