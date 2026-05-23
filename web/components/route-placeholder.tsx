import { PageHeader } from "@/components/page-header";
import { PhaseFourEmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, type StatusToken } from "@/components/ui/status-badge";

export function RoutePlaceholder({
  eyebrow,
  title,
  description,
  readModel,
  checkpoints,
}: {
  eyebrow: string;
  title: string;
  description: string;
  readModel: string;
  checkpoints?: Array<{ label: string; status: StatusToken }>;
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <PhaseFourEmptyState readModel={readModel} />
        <Card>
          <CardHeader>
            <CardTitle>What This Page Will Do</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              This first website slice is focused on layout and navigation. The
              live page will show real catering work once the secure database
              views are connected.
            </p>
            <p>
              Safety checks, quantities, student matching, and caterer messages
              stay owned by the backend workflow.
            </p>
          </CardContent>
        </Card>
      </div>
      {checkpoints?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Workflow Preview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {checkpoints.map((checkpoint) => (
              <div
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted px-3 py-2"
                key={checkpoint.label}
              >
                <span className="text-sm font-medium">{checkpoint.label}</span>
                <StatusBadge status={checkpoint.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
