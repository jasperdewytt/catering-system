import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (getSupabasePublicEnv()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-brand text-base font-semibold text-white">
              P
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Padea</p>
              <p className="text-xs text-muted-foreground">Catering Ops</p>
            </div>
          </div>
          <CardTitle>Operator Sign In</CardTitle>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Use Supabase Auth email and password credentials. Operational data
            remains unavailable until Phase 4 RLS-safe views are added.
          </p>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
