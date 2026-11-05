import { Button } from "@/components/ui/button";
import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table,
  Undo2,
} from "lucide-react";
import type { MouseEvent } from "react";
import type { MarkdownFormat } from "@/lib/markdownFormat";

interface MarkdownToolbarProps {
  disabled?: boolean;
  onFormat: (format: MarkdownFormat) => void;
  onUndo: () => void;
  onRedo: () => void;
}

const FORMAT_BUTTONS: { format: MarkdownFormat; label: string; icon: typeof Bold }[] = [
  { format: "bold", label: "Negrito (Ctrl+B)", icon: Bold },
  { format: "italic", label: "Itálico (Ctrl+I)", icon: Italic },
  { format: "strike", label: "Tachado", icon: Strikethrough },
  { format: "heading", label: "Título", icon: Heading2 },
  { format: "bullet", label: "Lista com marcadores", icon: List },
  { format: "numbered", label: "Lista numerada", icon: ListOrdered },
  { format: "checklist", label: "Lista de verificação", icon: ListChecks },
  { format: "quote", label: "Citação", icon: Quote },
  { format: "code", label: "Código", icon: Code },
  { format: "link", label: "Link", icon: Link },
  { format: "table", label: "Inserir tabela", icon: Table },
  { format: "divider", label: "Linha horizontal", icon: Minus },
];

export default function MarkdownToolbar({ disabled, onFormat, onUndo, onRedo }: MarkdownToolbarProps) {
  const preventFocusLoss = (e: MouseEvent<HTMLButtonElement>) => e.preventDefault();

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border border-input bg-gray-50 p-1">
      {FORMAT_BUTTONS.map(({ format, label, icon: Icon }) => (
        <Button
          key={format}
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title={label}
          aria-label={label}
          disabled={disabled}
          onMouseDown={preventFocusLoss}
          onClick={() => onFormat(format)}
        >
          <Icon className="h-4 w-4" />
        </Button>
      ))}
      <span className="mx-1 h-5 w-px bg-gray-300" aria-hidden="true" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Desfazer (Ctrl+Z)"
        aria-label="Desfazer"
        disabled={disabled}
        onMouseDown={preventFocusLoss}
        onClick={onUndo}
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Refazer (Ctrl+Shift+Z)"
        aria-label="Refazer"
        disabled={disabled}
        onMouseDown={preventFocusLoss}
        onClick={onRedo}
      >
        <Redo2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
