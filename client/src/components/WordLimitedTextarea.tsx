import { Textarea } from "@/components/ui/textarea";
import { countWords } from "@/lib/improveTextApi";
import { cn } from "@/lib/utils";

type WordLimitedTextareaProps = Omit<
  React.ComponentProps<typeof Textarea>,
  "value" | "onChange"
> & {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  wordLimit: number;
};

export function WordLimitedTextarea({
  wordLimit,
  value,
  onChange,
  className,
  ...props
}: WordLimitedTextareaProps) {
  const wordCount = countWords(value || "");
  const isOver = wordCount > wordLimit;

  return (
    <div className="space-y-1">
      <Textarea
        value={value}
        onChange={onChange}
        className={cn(isOver && "border-red-500 focus-visible:ring-red-500", className)}
        {...props}
      />
      <p className={cn("text-xs text-right", isOver ? "font-medium text-red-500" : "text-gray-500")}>
        {wordCount} / {wordLimit} palavras
      </p>
    </div>
  );
}
