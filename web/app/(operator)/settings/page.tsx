import { RoutePlaceholder } from "@/components/route-placeholder";

export default function SettingsPage() {
  return (
    <RoutePlaceholder
      eyebrow="Settings"
      title="Operator Settings"
      description="Settings will show session identity, operator profile mapping, and build metadata without adding submission-time write workflows."
      readModel="session user, operators"
      checkpoints={[
        { label: "Auth", status: "Ready" },
        { label: "Operator profile", status: "Blocked" },
        { label: "Build metadata", status: "Ready" },
      ]}
    />
  );
}
