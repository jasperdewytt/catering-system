"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";

import { signInWithPassword, type AuthActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(
    signInWithPassword,
    initialState,
  );

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          autoComplete="email"
          id="email"
          name="email"
          placeholder="operator@example.com"
          required
          type="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          autoComplete="current-password"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>
      {state.error ? (
        <div className="rounded-md border border-[var(--err-border)] bg-[var(--err-bg)] px-3 py-2 text-sm text-[var(--err-fg)]">
          {state.error}
        </div>
      ) : null}
      <Button
        className="w-full"
        disabled={pending}
        type="submit"
        variant="primary"
      >
        <LogIn className="size-4" aria-hidden="true" />
        {pending ? "Signing in" : "Sign in"}
      </Button>
    </form>
  );
}
