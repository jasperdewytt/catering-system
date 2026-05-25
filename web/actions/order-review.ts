"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type OrderReviewActionResult<T = undefined> =
  | { ok: true; data?: T; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const reasonSchema = z.string().trim().min(10, "Enter at least 10 characters.");
const uuidSchema = z.string().uuid("Expected a valid UUID.");
const weekStartSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date.");

const orderRunReasonSchema = z.object({
  weekStart: weekStartSchema,
  orderRunId: uuidSchema,
  reason: reasonSchema,
});

const manualOverrideSchema = orderRunReasonSchema.extend({
  overrideType: z.enum([
    "allocation",
    "order_line",
    "student_attendance",
    "dietary_resolution",
    "contact",
    "other",
  ]),
  entityType: z.string().trim().min(1, "Choose what the override concerns."),
  entityId: z
    .union([uuidSchema, z.literal("")])
    .transform((value) => (value ? value : null)),
});

export type OrderRunReasonInput = z.infer<typeof orderRunReasonSchema>;
export type ManualOverrideInput = z.input<typeof manualOverrideSchema>;

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

function revalidateOrderReviewPaths(weekStart: string, orderRunId: string) {
  revalidatePath("/dashboard");
  revalidatePath(`/weeks/${weekStart}`);
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
  return error?.message ?? "The order review write was rejected.";
}

export async function approveOrderRun(
  input: OrderRunReasonInput,
): Promise<OrderReviewActionResult<{ orderRunId: string }>> {
  const parsed = orderRunReasonSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the approval form.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { supabase, error } = await getOperatorClient();

  if (error) {
    return { ok: false, error };
  }

  const { data, error: rpcCallError } = await supabase.rpc(
    "operator_approve_order_run",
    {
      p_order_run_id: parsed.data.orderRunId,
      p_reason: parsed.data.reason,
    },
  );

  if (rpcCallError) {
    return { ok: false, error: rpcError(rpcCallError) };
  }

  revalidateOrderReviewPaths(parsed.data.weekStart, parsed.data.orderRunId);

  return {
    ok: true,
    data: { orderRunId: data },
    message: "Order run approved and audited.",
  };
}

export async function reopenOrderRun(
  input: OrderRunReasonInput,
): Promise<OrderReviewActionResult<{ orderRunId: string }>> {
  const parsed = orderRunReasonSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the reopen form.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { supabase, error } = await getOperatorClient();

  if (error) {
    return { ok: false, error };
  }

  const { data, error: rpcCallError } = await supabase.rpc(
    "operator_reopen_order_run",
    {
      p_order_run_id: parsed.data.orderRunId,
      p_reason: parsed.data.reason,
    },
  );

  if (rpcCallError) {
    return { ok: false, error: rpcError(rpcCallError) };
  }

  revalidateOrderReviewPaths(parsed.data.weekStart, parsed.data.orderRunId);

  return {
    ok: true,
    data: { orderRunId: data },
    message: "Order run reopened and audited.",
  };
}

export async function recordManualOverride(
  input: ManualOverrideInput,
): Promise<OrderReviewActionResult<{ manualOverrideId: string }>> {
  const parsed = manualOverrideSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the manual override form.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { supabase, error } = await getOperatorClient();

  if (error) {
    return { ok: false, error };
  }

  const { data, error: rpcCallError } = await supabase.rpc(
    "operator_record_manual_override",
    {
      p_order_run_id: parsed.data.orderRunId,
      p_override_type: parsed.data.overrideType,
      p_entity_type: parsed.data.entityType,
      p_entity_id: parsed.data.entityId as string,
      p_reason: parsed.data.reason,
    },
  );

  if (rpcCallError) {
    return { ok: false, error: rpcError(rpcCallError) };
  }

  revalidateOrderReviewPaths(parsed.data.weekStart, parsed.data.orderRunId);

  return {
    ok: true,
    data: { manualOverrideId: data },
    message: "Manual override intent recorded and audited.",
  };
}
