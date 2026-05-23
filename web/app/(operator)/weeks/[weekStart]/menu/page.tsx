import { RoutePlaceholder } from "@/components/route-placeholder";

export default async function WeekMenuPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const { weekStart } = await params;

  return (
    <RoutePlaceholder
      eyebrow={`Week ${weekStart}`}
      title="Menu Setup"
      description="The menu workflow is deferred until audited menu-offer and variant write contracts exist."
      readModel="operator_menu_setup"
      checkpoints={[
        { label: "Variants reviewed", status: "Unreviewed" },
        { label: "Offers saved", status: "Blocked" },
        { label: "Safety rules", status: "Blocked" },
      ]}
    />
  );
}
