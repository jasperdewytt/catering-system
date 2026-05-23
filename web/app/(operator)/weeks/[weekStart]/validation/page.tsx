import { RoutePlaceholder } from "@/components/route-placeholder";

export default async function WeekValidationPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const { weekStart } = await params;

  return (
    <RoutePlaceholder
      eyebrow={`Week ${weekStart}`}
      title="Validation"
      description="Validation findings will display persisted or view-backed backend results. This scaffold does not recompute preflight rules in TypeScript."
      readModel="operator_validation_summary, operator_order_run_issues"
      checkpoints={[
        { label: "Errors", status: "Blocked" },
        { label: "Warnings", status: "Unreviewed" },
        { label: "Ready", status: "Ready" },
      ]}
    />
  );
}
