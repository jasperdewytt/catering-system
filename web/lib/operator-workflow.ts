import type { StatusToken } from "@/components/ui/status-badge";
import type {
  OperatorShellCommunication,
  OperatorWeekStatus,
} from "@/lib/operator-read-models";

export type ShellWorkflowData = {
  currentWeekStart: string | null;
  weekStatuses: OperatorWeekStatus[];
  communications: OperatorShellCommunication[];
};

export type ShellWorkflowAction = {
  title: string;
  detail: string;
  href: string;
  status: StatusToken;
};

export function deriveShellWorkflowAction({
  activeWeekStart,
  communications,
  error,
  weekStatus,
}: {
  activeWeekStart: string | null;
  communications: OperatorShellCommunication[];
  error?: string | null;
  weekStatus: OperatorWeekStatus | null;
}): ShellWorkflowAction {
  if (error) {
    return {
      title: "Workflow unavailable",
      detail: "Week status could not be loaded. Open Weeks to continue.",
      href: "/weeks",
      status: "Unreviewed",
    };
  }

  if (!activeWeekStart) {
    return {
      title: "Choose a week",
      detail: "Open a service week before continuing the workflow.",
      href: "/weeks",
      status: "Unreviewed",
    };
  }

  if (!weekStatus) {
    return {
      title: "Week not found",
      detail: "This week has no operator status row yet.",
      href: "/weeks",
      status: "Unreviewed",
    };
  }

  const weekHref = `/weeks/${activeWeekStart}`;

  if (!weekStatus.source_data_ready) {
    return {
      title: "Review source data",
      detail: "Session data is not ready for this week.",
      href: weekHref,
      status: "Blocked",
    };
  }

  if (!weekStatus.menu_offers_ready) {
    return {
      title: "Complete menu setup",
      detail: `${weekStatus.missing_offer_caterer_count ?? 0} caterer offer set(s) missing.`,
      href: `${weekHref}/menu`,
      status: "Blocked",
    };
  }

  if (!weekStatus.variant_review_ready) {
    return {
      title: "Review offered variants",
      detail: `${weekStatus.unreviewed_variant_count ?? 0} offered variant(s) need review.`,
      href: `${weekHref}/menu`,
      status: "Unreviewed",
    };
  }

  if (!weekStatus.latest_order_run_id) {
    return {
      title: "Generate order run",
      detail: "Menu setup is ready. Create the persisted order run next.",
      href: `${weekHref}/orders`,
      status: "Ready",
    };
  }

  if (weekStatus.validation_state === "blocked") {
    return {
      title: "Resolve validation issues",
      detail: `${weekStatus.blocking_issue_count ?? 0} blocking issue(s) need attention.`,
      href: `${weekHref}/validation`,
      status: "Blocked",
    };
  }

  if (weekStatus.validation_state === "warnings") {
    return {
      title: "Review validation warnings",
      detail: `${weekStatus.warning_count ?? 0} warning(s) should be checked before approval.`,
      href: `${weekHref}/validation`,
      status: "Unreviewed",
    };
  }

  if (weekStatus.approval_state === "pending_approval") {
    return {
      title: "Approve order run",
      detail: "A generated run is ready for operator review.",
      href: `${weekHref}/orders`,
      status: "Generated",
    };
  }

  if (weekStatus.approval_state !== "approved") {
    return {
      title: "Review order run",
      detail: "Open order review before preparing caterer emails.",
      href: `${weekHref}/orders`,
      status: "Unreviewed",
    };
  }

  const weekCommunications = communications.filter(
    (communication) =>
      communication.week_start === activeWeekStart &&
      communication.order_run_id === weekStatus.latest_order_run_id,
  );
  const sentCount = weekCommunications.filter(
    (communication) => communication.email_state === "sent",
  ).length;
  const failedCount = weekCommunications.filter(
    (communication) => communication.email_state === "failed",
  ).length;

  if (
    weekCommunications.length > 0 &&
    sentCount === weekCommunications.length
  ) {
    return {
      title: "Week ready",
      detail: `${sentCount} caterer email(s) sent for this week.`,
      href: `${weekHref}/exports`,
      status: "Sent",
    };
  }

  if (failedCount > 0) {
    return {
      title: "Review failed sends",
      detail: `${failedCount} caterer email send attempt(s) need follow-up.`,
      href: `${weekHref}/exports`,
      status: "Failed",
    };
  }

  if (
    weekStatus.export_state === "not_ready" ||
    weekStatus.export_state === "not_exported" ||
    weekStatus.export_state === "partial"
  ) {
    return {
      title: "Create email snapshots",
      detail: "Prepare persisted caterer email snapshots for the approved run.",
      href: `${weekHref}/exports`,
      status: weekStatus.export_state === "partial" ? "Exported" : "Unreviewed",
    };
  }

  return {
    title: "Review caterer emails",
    detail: "Email snapshots are ready for operator review or sending.",
    href: `${weekHref}/exports`,
    status: "Exported",
  };
}
