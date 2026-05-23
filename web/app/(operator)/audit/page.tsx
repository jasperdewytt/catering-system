import { RoutePlaceholder } from "@/components/route-placeholder";

export default function AuditPage() {
  return (
    <RoutePlaceholder
      eyebrow="Audit"
      title="Audit Events"
      description="The append-only audit trail will render filtered operator events after the operator_audit_events view is added."
      readModel="operator_audit_events"
      checkpoints={[
        { label: "Approvals", status: "Approved" },
        { label: "Exports", status: "Exported" },
        { label: "Overrides", status: "Unreviewed" },
      ]}
    />
  );
}
