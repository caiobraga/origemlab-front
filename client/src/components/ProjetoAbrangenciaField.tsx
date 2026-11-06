import { useState } from "react";
import { Label } from "@/components/ui/label";
import { UF_LABELS } from "@/lib/projetoFormFields";

type Props = {
  value: string[];
  onChange: (ufs: string[]) => void;
};

/** Região onde o projeto pode ser executado: nacional ou lista de UFs. */
export default function ProjetoAbrangenciaField({ value, onChange }: Props) {
  const [restrito, setRestrito] = useState(value.length > 0);
  const ufs = Object.keys(UF_LABELS);

  const toggle = (uf: string) => {
    const next = value.includes(uf) ? value.filter((u) => u !== uf) : [...value, uf];
    onChange(ufs.filter((u) => next.includes(u)));
  };

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label>Região de execução</Label>
      <p className="text-xs text-gray-500">
        Editais de fundações estaduais (FAPs) de outros estados deixam de aparecer na busca. Editais
        nacionais (CNPq, FINEP, BNDES…) continuam valendo.
      </p>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="abrangencia"
            checked={!restrito}
            onChange={() => {
              setRestrito(false);
              onChange([]);
            }}
          />
          Nacional (qualquer estado)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="abrangencia"
            checked={restrito}
            onChange={() => setRestrito(true)}
          />
          Apenas em estados específicos
        </label>
      </div>
      {restrito && value.length === 0 && (
        <p className="text-xs text-amber-700">Selecione ao menos um estado.</p>
      )}
      {restrito && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {ufs.map((uf) => {
            const on = value.includes(uf);
            return (
              <button
                key={uf}
                type="button"
                title={UF_LABELS[uf]}
                aria-pressed={on}
                onClick={() => toggle(uf)}
                className={`rounded-md border px-2 py-1 text-xs font-semibold transition-colors ${
                  on
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-white text-gray-700 hover:border-primary"
                }`}
              >
                {uf}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
