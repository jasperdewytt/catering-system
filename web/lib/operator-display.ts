import type { StatusToken } from "@/components/ui/status-badge";

export function formatDate(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatStatus(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatMoney(value: number | null): string {
  if (value === null) {
    return "Not priced";
  }

  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(value);
}

export function formatEmailState(value: string | null): string {
  if (value === "exported") {
    return "Email ready";
  }

  if (value === "partial") {
    return "Some emails ready";
  }

  if (value === "not_exported") {
    return "Not emailed yet";
  }

  if (value === "not_ready") {
    return "Not ready for email";
  }

  return "Not emailed yet";
}

export function formatAuditAction(
  displayAction: string | null,
  action: string | null,
): string {
  if (action === "order_run_generated") {
    return "Order generated";
  }

  if (action === "communication_exported") {
    return "Email prepared";
  }

  return displayAction ?? formatStatus(action);
}

export function statusToken(value: string | boolean | null): StatusToken {
  if (value === true || value === "ready") {
    return "Ready";
  }

  if (value === "approved") {
    return "Approved";
  }

  if (value === "exported") {
    return "Exported";
  }

  if (value === "generated" || value === "pending_approval") {
    return "Generated";
  }

  if (value === "superseded") {
    return "Superseded";
  }

  if (value === false || value === "blocked") {
    return "Blocked";
  }

  return "Unreviewed";
}
