import { RoutePlaceholder } from "@/components/route-placeholder";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

  return (
    <RoutePlaceholder
      eyebrow="Student"
      title={`Student ${studentId}`}
      description="Student detail pages are read-only inspection surfaces until authenticated views expose profile, attendance, allocation, and audit slices."
      readModel="operator_student_detail"
      checkpoints={[
        { label: "Profile", status: "Blocked" },
        { label: "Attendance", status: "Blocked" },
        { label: "Audit", status: "Blocked" },
      ]}
    />
  );
}
