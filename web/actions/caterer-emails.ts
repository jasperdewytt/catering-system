"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type CatererEmailActionResult<T = undefined> =
  | { ok: true; data?: T; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const reasonSchema = z.string().trim().min(10, "Enter at least 10 characters.");
const uuidSchema = z.string().uuid("Expected a valid UUID.");
const weekStartSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date.");

const recordPreparationSchema = z.object({
  weekStart: weekStartSchema,
  orderRunId: uuidSchema,
  communicationId: uuidSchema,
  reason: reasonSchema,
});

export type RecordPreparationInput = z.infer<typeof recordPreparationSchema>;

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

function revalidateCatererEmailPaths(weekStart: string, orderRunId: string) {
  revalidatePath("/dashboard");
  revalidatePath(`/weeks/${weekStart}`);
  revalidatePath(`/weeks/${weekStart}/exports`);
  revalidatePath(`/weeks/${weekStart}/orders`);
  revalidatePath(`/weeks/${weekStart}/orders/${orderRunId}`);
  revalidatePath("/audit");
}

async function getOperatorClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { supabase, error: "Sign in as an operator before saving changes." };
  }

  const { data: operator, error: operatorError } = await supabase
    .from("operators")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (operatorError || !operator) {
    return {
      supabase,
      error: "Your account is not registered as a Padea operator.",
    };
  }

  return { supabase, error: null };
}

function rpcError(error: { message?: string } | null): string {
  return error?.message ?? "The caterer email write was rejected.";
}

export async function recordCatererEmailPreparation(
  input: RecordPreparationInput,
): Promise<CatererEmailActionResult<{ eventId: string }>> {
  const parsed = recordPreparationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the email preparation form.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { supabase, error } = await getOperatorClient();

  if (error) {
    return { ok: false, error };
  }

  const { data, error: rpcCallError } = await supabase.rpc(
    "operator_record_caterer_email_preparation",
    {
      p_communication_id: parsed.data.communicationId,
      p_reason: parsed.data.reason,
    },
  );

  if (rpcCallError) {
    return { ok: false, error: rpcError(rpcCallError) };
  }

  revalidateCatererEmailPaths(parsed.data.weekStart, parsed.data.orderRunId);

  return {
    ok: true,
    data: { eventId: data },
    message: "Caterer email preparation recorded and audited.",
  };
}
