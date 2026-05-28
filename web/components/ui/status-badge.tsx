import { cn } from "@/lib/utils";

export const STATUS_TOKENS = [
  "Ready",
  "Unreviewed",
  "Generated",
  "Approved",
  "Exported",
  "Sent",
  "Failed",
  "Blocked",
  "Superseded",
] as const;

export type StatusToken = (typeof STATUS_TOKENS)[number];

const statusStyles: Record<StatusToken, string> = {
  Ready: "border-[var(--ok-border)] bg-[var(--ok-bg)] text-[var(--ok-fg)]",
  Unreviewed:
    "border-[var(--warn-border)] bg-[var(--warn-bg)] text-[var(--warn-fg)]",
  Generated:
    "border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info-fg)]",
  Approved: "border-[var(--ok-border)] bg-[var(--ok-bg)] text-[var(--ok-fg)]",
  Exported: "border-[var(--ok-border)] bg-[var(--ok-bg)] text-[var(--ok-fg)]",
  Sent: "border-[var(--ok-border)] bg-[var(--ok-bg)] text-[var(--ok-fg)]",
  Failed: "border-[var(--err-border)] bg-[var(--err-bg)] text-[var(--err-fg)]",
  Blocked: "border-[var(--err-border)] bg-[var(--err-bg)] text-[var(--err-fg)]",
  Superseded:
    "border-[var(--muted-border)] bg-[var(--muted-bg)] text-[var(--muted-fg)]",
};

const statusLabels: Record<StatusToken, string> = {
  Ready: "Ready",
  Unreviewed: "Unreviewed",
  Generated: "Generated",
  Approved: "Approved",
  Exported: "Email ready",
  Sent: "Sent",
  Failed: "Send failed",
  Blocked: "Blocked",
  Superseded: "Superseded",
};

export function StatusBadge({
  status,
  className,
}: {
  status: StatusToken;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium",
        statusStyles[status],
        className,
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
