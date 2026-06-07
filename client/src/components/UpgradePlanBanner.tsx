import { Link } from "wouter";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type UpgradePlanBannerProps = {
  message: string;
  compact?: boolean;
};

export default function UpgradePlanBanner({ message, compact }: UpgradePlanBannerProps) {
  return (
    <div
      className={
        compact
          ? "rounded-md border border-primary/30 bg-secondary/60 px-4 py-3 text-sm text-gray-800"
          : "mb-6 rounded-md border border-primary/30 bg-secondary px-5 py-4 text-sm text-gray-800"
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <p>{message}</p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link href="/planos">Ver planos Pro</Link>
        </Button>
      </div>
    </div>
  );
}
