import { LoaderCircle } from "lucide-react";

export function LoadingState({
  label = "Loading operator console",
}: {
  label?: string;
}) {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>
  );
}
