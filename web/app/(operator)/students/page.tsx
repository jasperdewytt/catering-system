import { RoutePlaceholder } from "@/components/route-placeholder";

export default function StudentsPage() {
  return (
    <RoutePlaceholder
      eyebrow="Directory"
      title="Students"
      description="Student inspection will show identity, school, year level, opt-out state, dietary tags, absences, allocations, and scoped audit events."
      readModel="operator_students"
      checkpoints={[
        { label: "Profiles", status: "Blocked" },
        { label: "Dietary tags", status: "Blocked" },
        { label: "Allocations", status: "Generated" },
      ]}
    />
  );
}
