import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";

export default function WeekValidationLoading() {
  return (
    <>
      <PageHeader
        eyebrow="Validation"
        title="Loading Validation"
        description="Reading readiness summaries and latest persisted order-run issues."
      />
      <LoadingState label="Loading validation readiness" />
    </>
  );
}
