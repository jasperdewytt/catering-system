import { RoutePlaceholder } from "@/components/route-placeholder";

export default function CaterersPage() {
  return (
    <RoutePlaceholder
      eyebrow="Directory"
      title="Caterers"
      description="Caterer summaries will show assigned schools, contacts, weekly minimums, menu review state, and communication status."
      readModel="operator_caterers"
      checkpoints={[
        { label: "Contacts", status: "Blocked" },
        { label: "Menu review", status: "Unreviewed" },
        { label: "Export state", status: "Exported" },
      ]}
    />
  );
}
