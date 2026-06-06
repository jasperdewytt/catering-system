import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { OperatorShell } from "@/components/shell/operator-shell";
import {
  getOperatorProfile,
  getShellWorkflowReadModel,
} from "@/lib/operator-read-models";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OperatorLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!getSupabasePublicEnv()) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getOperatorProfile(supabase, user.id);
  const workflow = await getShellWorkflowReadModel(supabase);
  const displayName = profile.data?.display_name ?? user.email ?? "Operator";

  return (
    <OperatorShell
      userEmail={displayName}
      openExceptionCount={workflow.data?.openExceptionCount ?? 0}
    >
      {children}
    </OperatorShell>
  );
}
