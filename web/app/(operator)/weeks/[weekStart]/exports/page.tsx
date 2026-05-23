import { RoutePlaceholder } from "@/components/route-placeholder";

export default async function WeekExportsPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const { weekStart } = await params;

  return (
    <RoutePlaceholder
      eyebrow={`Week ${weekStart}`}
      title="Exports"
      description="Export previews must display persisted communication snapshots. This route does not render email templates in TypeScript."
      readModel="operator_communications, operator_order_run_contacts, operator_audit_events"
      checkpoints={[
        { label: "Snapshot", status: "Blocked" },
        { label: "Recipients", status: "Blocked" },
        { label: "Exported", status: "Exported" },
      ]}
    />
  );
}
