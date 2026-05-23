import { RoutePlaceholder } from "@/components/route-placeholder";

export default async function WeekOverviewPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const { weekStart } = await params;

  return (
    <RoutePlaceholder
      eyebrow={`Week ${weekStart}`}
      title="Week Overview"
      description="A weekly operational summary will appear here after Phase 4 adds week status, sessions, order runs, and audit read models."
      readModel="operator_week_status, operator_week_sessions, operator_order_runs, operator_audit_events"
      checkpoints={[
        { label: "Source data", status: "Ready" },
        { label: "Menu offers", status: "Unreviewed" },
        { label: "Validation", status: "Blocked" },
        { label: "Export state", status: "Exported" },
      ]}
    />
  );
}
