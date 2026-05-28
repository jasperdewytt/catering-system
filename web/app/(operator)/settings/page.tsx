import {
  KeyRound,
  Link2,
  ServerCog,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/operator-display";
import { getOperatorProfile } from "@/lib/operator-read-models";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import packageJson from "@/package.json";

function projectHost(url: string | undefined) {
  if (!url) {
    return "Not configured";
  }

  try {
    return new URL(url).host;
  } catch {
    return "Configured";
  }
}

function ConfigRow({
  label,
  value,
  ready,
}: {
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted px-3 py-2">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="mt-1 text-xs text-muted-foreground">{value}</div>
      </div>
      <StatusBadge status={ready ? "Ready" : "Blocked"} />
    </div>
  );
}

export default async function SettingsPage() {
  const publicEnv = getSupabasePublicEnv();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <PageHeader
          eyebrow="Operator"
          title="Operator Profile"
          description="Secure operator access and environment status."
        />
        <EmptyState
          icon={KeyRound}
          title="Operator session unavailable"
          description="Sign in again to view the current operator profile."
        />
      </>
    );
  }

  const profile = await getOperatorProfile(supabase, user.id);
  const bridgeConfigured = Boolean(
    process.env.PADEA_BACKEND_URL && process.env.PADEA_BACKEND_SHARED_SECRET,
  );

  return (
    <>
      <PageHeader
        eyebrow="Operator"
        title="Operator Profile"
        description="Signed-in identity, access state, and safe app metadata."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Signed-In Operator</CardTitle>
            <CardDescription>
              Supabase Auth session matched to the operator profile used in the
              audit trail.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border bg-muted p-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <UserRound className="size-4" aria-hidden="true" />
                  Display Name
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {profile.data?.display_name ?? "No operator profile"}
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted p-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <KeyRound className="size-4" aria-hidden="true" />
                  Email
                </div>
                <div className="mt-2 break-all text-sm font-medium text-foreground">
                  {user.email ?? "No email on session"}
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted p-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  Access State
                </div>
                <div className="mt-2">
                  <StatusBadge status={profile.data ? "Ready" : "Blocked"} />
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted p-3">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Last Sign-In
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {formatDateTime(user.last_sign_in_at ?? null)}
                </div>
              </div>
            </div>

            {profile.error ? (
              <EmptyState
                icon={ShieldCheck}
                title="Operator profile unavailable"
                description={profile.error}
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>App Metadata</CardTitle>
            <CardDescription>
              Environment-safe status only. Secrets and SMTP credentials stay
              outside the website.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ConfigRow
              label="Supabase access"
              ready={Boolean(publicEnv)}
              value={projectHost(publicEnv?.url)}
            />
            <ConfigRow
              label="Python bridge"
              ready={bridgeConfigured}
              value={
                bridgeConfigured
                  ? "Order generation and caterer email requests can reach the backend"
                  : "Backend URL or shared secret is not configured"
              }
            />
            <ConfigRow
              label="Email safety gate"
              ready
              value="Reviewed sends use the backend test-recipient override until real-recipient rollout"
            />
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              <ServerCog className="size-4 shrink-0" aria-hidden="true" />
              <span>Next.js {packageJson.dependencies.next}</span>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Link2 className="size-4 shrink-0" aria-hidden="true" />
              <span>Operator console {packageJson.version}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
