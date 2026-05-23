import { RoutePlaceholder } from "@/components/route-placeholder";

export default async function OrderRunDetailPage({
  params,
}: {
  params: Promise<{ weekStart: string; orderRunId: string }>;
}) {
  const { weekStart, orderRunId } = await params;

  return (
    <RoutePlaceholder
      eyebrow={`Week ${weekStart}`}
      title={`Order Run ${orderRunId}`}
      description="Order lines, allocations, issues, contacts, approval history, overrides, and audit will render only from RLS-safe views."
      readModel="operator_order_runs, operator_order_run_lines, operator_order_run_allocations, operator_order_run_issues, operator_audit_events"
      checkpoints={[
        { label: "Run", status: "Generated" },
        { label: "Approval", status: "Approved" },
        { label: "Issues", status: "Blocked" },
        { label: "Exports", status: "Exported" },
      ]}
    />
  );
}
