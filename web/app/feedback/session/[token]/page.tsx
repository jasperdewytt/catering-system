import { EmptyState } from "@/components/empty-state";
import { getManagerFeedbackContext } from "@/actions/feedback";

import { ManagerFeedbackForm } from "./manager-feedback-form";

export const dynamic = "force-dynamic";

export default async function ManagerFeedbackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getManagerFeedbackContext(token);

  if (result.error || !result.data) {
    return (
      <FeedbackShell>
        <EmptyState
          title="Feedback link unavailable"
          description={result.error ?? "This feedback link could not be loaded."}
        />
      </FeedbackShell>
    );
  }

  if (result.data.status === "submitted") {
    return (
      <FeedbackShell>
        <EmptyState
          title="Feedback already submitted"
          description="Thanks. This session feedback link has already been used."
        />
      </FeedbackShell>
    );
  }

  if (result.data.status === "expired") {
    return (
      <FeedbackShell>
        <EmptyState
          title="Feedback link expired"
          description="This link is outside the 8-day feedback window."
        />
      </FeedbackShell>
    );
  }

  return (
    <FeedbackShell>
      <ManagerFeedbackForm context={result.data} token={token} />
    </FeedbackShell>
  );
}

function FeedbackShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-4 py-8">
      {children}
    </main>
  );
}
