import { RoutePlaceholder } from "@/components/route-placeholder";

export default async function CatererDetailPage({
  params,
}: {
  params: Promise<{ catererId: string }>;
}) {
  const { catererId } = await params;

  return (
    <RoutePlaceholder
      eyebrow="Caterer"
      title={`Caterer ${catererId}`}
      description="Detail pages will inspect menu setup, contacts, communications, and weekly order state once Phase 4 views exist."
      readModel="operator_caterer_detail, operator_menu_setup, operator_communications"
      checkpoints={[
        { label: "Profile", status: "Blocked" },
        { label: "Menu", status: "Unreviewed" },
        { label: "Exports", status: "Exported" },
      ]}
    />
  );
}
