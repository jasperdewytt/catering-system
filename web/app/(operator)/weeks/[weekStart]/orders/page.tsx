import { RoutePlaceholder } from "@/components/route-placeholder";

export default async function WeekOrdersPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const { weekStart } = await params;

  return (
    <RoutePlaceholder
      eyebrow={`Week ${weekStart}`}
      title="Order Runs"
      description="Generated order runs remain backend-owned. A future job bridge may trigger generation; this page only prepares the read-only route."
      readModel="operator_order_runs"
      checkpoints={[
        { label: "Latest run", status: "Generated" },
        { label: "Approved", status: "Approved" },
        { label: "Superseded", status: "Superseded" },
      ]}
    />
  );
}
