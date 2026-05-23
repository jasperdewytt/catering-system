import type { LucideIcon } from "lucide-react";
import { DatabaseZap } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = DatabaseZap,
  title,
  description,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border bg-card p-6 text-center",
        className,
      )}
    >
      <div className="mx-auto flex size-10 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

export function PhaseFourEmptyState({ readModel }: { readModel: string }) {
  return (
    <EmptyState
      title="This page is not connected yet"
      description={`The secure data source for this page is still being prepared. It will use ${readModel} when the live operator views are connected.`}
    />
  );
}
