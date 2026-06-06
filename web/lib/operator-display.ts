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
  if (value === "sent") {
    return "Sent";
  }

  if (value === "failed") {
    return "Send failed";
  }

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
  if (action === "autopilot_run_started") {
    return "Autopilot started";
  }

  if (action === "autopilot_run_completed") {
    return "Autopilot completed";
  }

  if (action === "autopilot_exception_created") {
    return "Autopilot exception";
  }

  if (action === "autopilot_exception_resolved") {
    return "Exception resolved";
  }

  if (action === "order_run_generated") {
    return "Order generated";
  }

  if (action === "communication_exported") {
    return "Email prepared";
  }

  if (action === "communication_sent") {
    return "Email sent";
  }

  if (action === "communication_send_failed") {
    return "Email send failed";
  }

  return displayAction ?? formatStatus(action);
}

export function formatAutopilotStatus(value: string | null): string {
  if (value === "completed") {
    return "Completed";
  }

  if (value === "running") {
    return "Running";
  }

  if (value === "blocked") {
    return "Blocked";
  }

  if (value === "human_review_required") {
    return "Needs review";
  }

  if (value === "failed") {
    return "Failed";
  }

  if (value === "started") {
    return "Started";
  }

  return value ? formatStatus(value) : "Not run";
}

export function formatExceptionSeverity(value: string | null): string {
  if (value === "critical") {
    return "Critical";
  }

  if (value === "blocked") {
    return "Blocking";
  }

  if (value === "review") {
    return "Review";
  }

  if (value === "info") {
    return "Info";
  }

  return formatStatus(value);
}

export function formatExceptionCategory(value: string | null): string {
  if (value === "validation_gate") {
    return "Validation gate";
  }

  if (value === "allocation_issue") {
    return "Allocation issue";
  }

  if (value === "communication_gate") {
    return "Communication gate";
  }

  if (value === "reply_low_confidence") {
    return "Low-confidence reply";
  }

  if (value === "reply_unavailable_item") {
    return "Unavailable item";
  }

  if (value === "reply_safety_ambiguity") {
    return "Safety ambiguity";
  }

  if (value === "caterer_quality") {
    return "Caterer quality";
  }

  return formatStatus(value);
}

export function formatConfidence(value: number | null): string {
  if (value === null) {
    return "Not scored";
  }

  return new Intl.NumberFormat("en-AU", {
    maximumFractionDigits: 0,
    style: "percent",
  }).format(value);
}

export function formatReplyHandledStatus(value: string | null): string {
  if (value === "handled") {
    return "Handled";
  }

  if (value === "auto_handled") {
    return "Auto-handled";
  }

  if (value === "auto_adjusted") {
    return "Auto-adjusted";
  }

  if (value === "refused") {
    return "Refused";
  }

  if (value === "needs_review") {
    return "Needs review";
  }

  if (value === "pending") {
    return "Pending";
  }

  return formatStatus(value);
}

export function statusToken(value: string | boolean | null): StatusToken {
  if (value === true || value === "ready") {
    return "Ready";
  }

  if (
    value === "completed" ||
    value === "auto_handled" ||
    value === "auto_adjusted" ||
    value === "handled"
  ) {
    return "Ready";
  }

  if (value === "running" || value === "started") {
    return "Generated";
  }

  if (value === "approved") {
    return "Approved";
  }

  if (value === "exported") {
    return "Exported";
  }

  if (value === "sent") {
    return "Sent";
  }

  if (value === "failed") {
    return "Failed";
  }

  if (value === "generated" || value === "pending_approval") {
    return "Generated";
  }

  if (value === "superseded") {
    return "Superseded";
  }

  if (
    value === false ||
    value === "blocked" ||
    value === "critical" ||
    value === "failed" ||
    value === "refused"
  ) {
    return "Blocked";
  }

  if (value === "human_review_required" || value === "needs_review") {
    return "Unreviewed";
  }

  return "Unreviewed";
}
