import { CalendarClock, LogOut, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { ShellNavigation } from "@/components/shell/navigation";

export function OperatorShell({
  children,
  userEmail,
}: {
  children: ReactNode;
  userEmail: string;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-border bg-card md:block">
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          <div className="flex size-8 items-center justify-center rounded-md bg-brand text-sm font-semibold text-white">
            P
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Padea</div>
            <div className="text-xs text-muted-foreground">Catering Ops</div>
          </div>
        </div>
        <div className="py-3">
          <ShellNavigation />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <div className="md:hidden">
              <div className="flex size-8 items-center justify-center rounded-md bg-brand text-sm font-semibold text-white">
                P
              </div>
            </div>
            <div className="hidden items-center gap-2 rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs text-muted-foreground sm:flex">
              <CalendarClock className="size-4" aria-hidden="true" />
              Current week
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 items-center gap-2 text-sm text-muted-foreground sm:flex">
              <ShieldCheck
                className="size-4 text-[var(--ok-fg)]"
                aria-hidden="true"
              />
              <span className="truncate">{userEmail}</span>
            </div>
            <form action={signOut}>
              <Button size="sm" variant="ghost" type="submit" title="Sign out">
                <LogOut className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </form>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
