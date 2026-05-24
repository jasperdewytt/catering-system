import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";

export default function WeekMenuLoading() {
  return (
    <>
      <PageHeader
        eyebrow="Menu setup"
        title="Loading Menu Setup"
        description="Reading caterer variants, offers, and menu readiness."
      />
      <LoadingState label="Loading menu setup" />
    </>
  );
}
