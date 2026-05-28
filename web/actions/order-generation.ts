"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type GenerateOrderRunActionResult<T = undefined> =
  | { ok: true; data: T; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const weekStartSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date.");

const generateOrderRunSchema = z.object({
  weekStart: weekStartSchema,
  reason: z
    .string()
    .trim()
    .max(500, "Keep the note under 500 characters.")
    .optional(),
});

const backendOrderRunResponseSchema = z.object({
  orderRunId: z.string().uuid(),
  status: z.string(),
  allocations: z.number(),
  orderLines: z.number(),
  issues: z.number(),
});

export type GenerateOrderRunInput = z.infer<typeof generateOrderRunSchema>;

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

function backendConfig(): { url: string; secret: string } | { error: string } {
  const url = process.env.PADEA_BACKEND_URL?.replace(/\/+$/, "");
  const secret = process.env.PADEA_BACKEND_SHARED_SECRET;

  if (!url || !secret) {
    return {
      error: "The Python backend bridge is not configured for order generation.",
    };
  }

  return { url, secret };
}

function backendError(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "detail" in value &&
    typeof value.detail === "string"
  ) {
    return value.detail;
  }

  return "The Python backend rejected the order generation request.";
}

function revalidateOrderGenerationPaths(weekStart: string, orderRunId: string) {
  revalidatePath("/dashboard");
  revalidatePath(`/weeks/${weekStart}`);
  revalidatePath(`/weeks/${weekStart}/orders`);
  revalidatePath(`/weeks/${weekStart}/orders/${orderRunId}`);
  revalidatePath(`/weeks/${weekStart}/validation`);
  revalidatePath(`/weeks/${weekStart}/exports`);
  revalidatePath("/audit");
}

async function getOperatorDisplayName(): Promise<
  { displayName: string } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Sign in as an operator before generating orders." };
  }

  const { data: operator, error: operatorError } = await supabase
    .from("operators")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (operatorError || !operator) {
    return { error: "Your account is not registered as a Padea operator." };
  }

  return { displayName: operator.display_name as string };
}

export async function generateOrderRun(
  input: GenerateOrderRunInput,
): Promise<
  GenerateOrderRunActionResult<{
    orderRunId: string;
    status: string;
    allocations: number;
    orderLines: number;
    issues: number;
  }>
> {
  const parsed = generateOrderRunSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the generation form.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const operator = await getOperatorDisplayName();

  if ("error" in operator) {
    return { ok: false, error: operator.error };
  }

  if (!operator.displayName) {
    return {
      ok: false,
      error: "Your operator profile is missing a display name.",
    };
  }

  const config = backendConfig();

  if ("error" in config) {
    return { ok: false, error: config.error };
  }

  let response: Response;

  try {
    response = await fetch(`${config.url}/internal/order-runs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        weekStart: parsed.data.weekStart,
        actorName: operator.displayName,
        reason: parsed.data.reason ?? "",
      }),
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      error: "The Python backend bridge could not be reached.",
    };
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    return { ok: false, error: backendError(body) };
  }

  const backendResult = backendOrderRunResponseSchema.safeParse(body);

  if (!backendResult.success) {
    return {
      ok: false,
      error: "The Python backend returned an unexpected order-run response.",
    };
  }

  revalidateOrderGenerationPaths(
    parsed.data.weekStart,
    backendResult.data.orderRunId,
  );

  return {
    ok: true,
    data: backendResult.data,
    message: "Order run generated and audited.",
  };
}
