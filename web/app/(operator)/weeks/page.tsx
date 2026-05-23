import { RoutePlaceholder } from "@/components/route-placeholder";

export default function WeeksPage() {
  return (
    <RoutePlaceholder
      eyebrow="Weeks"
      title="Service Weeks"
      description="Browse historical and current service weeks once the operator_weeks view exists."
      readModel="operator_weeks"
      checkpoints={[
        { label: "Generated", status: "Generated" },
        { label: "Approved", status: "Approved" },
        { label: "Exported", status: "Exported" },
        { label: "Superseded", status: "Superseded" },
      ]}
    />
  );
}
