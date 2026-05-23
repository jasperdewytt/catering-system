import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { OperatorShell } from "@/components/shell/operator-shell";
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

  return (
    <OperatorShell userEmail={user.email ?? "Authenticated operator"}>
      {children}
    </OperatorShell>
  );
}
