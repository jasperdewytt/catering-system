"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type CatererEmailActionResult<T = undefined> =
  | { ok: true; data?: T; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const reasonSchema = z.string().trim().min(10, "Enter at least 10 characters.");
const optionalReasonSchema = z
  .string()
  .trim()
  .refine(
    (value) => value.length === 0 || value.length >= 10,
    "Enter at least 10 characters, or leave blank.",
  )
  .optional();
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

const createSnapshotSchema = z.object({
  weekStart: weekStartSchema,
  orderRunId: uuidSchema,
  catererId: uuidSchema,
  reason: optionalReasonSchema,
});

const createSnapshotsSchema = z.object({
  weekStart: weekStartSchema,
  orderRunId: uuidSchema,
  catererIds: z.array(uuidSchema).min(1, "Select at least one caterer."),
  reason: optionalReasonSchema,
});

const sendEmailSchema = z.object({
  weekStart: weekStartSchema,
  orderRunId: uuidSchema,
  communicationIds: z.array(uuidSchema).min(1, "Select at least one email."),
  reason: reasonSchema,
});

const backendSnapshotResponseSchema = z.object({
  communicationId: uuidSchema,
  eventId: uuidSchema,
  snapshotCreated: z.boolean(),
});

const backendSendItemSchema = z.object({
  communicationId: uuidSchema,
  eventId: uuidSchema,
  status: z.string(),
  catererId: uuidSchema,
  metadata: z.record(z.string(), z.unknown()),
});

const backendSendResponseSchema = z.object({
  sent: z.array(backendSendItemSchema),
  failed: z.array(backendSendItemSchema),
});

export type RecordPreparationInput = z.infer<typeof recordPreparationSchema>;
export type CreateSnapshotInput = z.infer<typeof createSnapshotSchema>;
export type CreateSnapshotsInput = z.infer<typeof createSnapshotsSchema>;
export type SendEmailInput = z.infer<typeof sendEmailSchema>;

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

function revalidateCatererEmailPaths(
  weekStart: string,
  orderRunId: string,
  catererId?: string,
) {
  revalidatePath("/dashboard");
  revalidatePath(`/weeks/${weekStart}`);
  revalidatePath(`/weeks/${weekStart}/exports`);
  revalidatePath(`/weeks/${weekStart}/orders`);
  revalidatePath(`/weeks/${weekStart}/orders/${orderRunId}`);
  revalidatePath("/caterers");
  if (catererId) {
    revalidatePath(`/caterers/${catererId}`);
  }
  revalidatePath("/audit");
}

async function getOperatorClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      operator: null,
      error: "Sign in as an operator before saving changes.",
    };
  }

  const { data: operator, error: operatorError } = await supabase
    .from("operators")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (operatorError || !operator) {
    return {
      supabase,
      operator: null,
      error: "Your account is not registered as a Padea operator.",
    };
  }

  return { supabase, operator, error: null };
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

function backendConfig(): { url: string; secret: string } | { error: string } {
  const url = process.env.PADEA_BACKEND_URL?.replace(/\/+$/, "");
  const secret = process.env.PADEA_BACKEND_SHARED_SECRET;

  if (!url || !secret) {
    return {
      error:
        "The Python backend bridge is not configured for caterer email actions.",
    };
  }

  return { url, secret };
}

function backendError(value: unknown, fallback: string): string {
  if (
    value &&
    typeof value === "object" &&
    "detail" in value &&
    typeof value.detail === "string"
  ) {
    return value.detail;
  }

  return fallback;
}

async function callSnapshotBridge({
  actorName,
  catererId,
  config,
  orderRunId,
  reason,
}: {
  actorName: string;
  catererId: string;
  config: { url: string; secret: string };
  orderRunId: string;
  reason?: string;
}): Promise<
  | {
      ok: true;
      data: z.infer<typeof backendSnapshotResponseSchema>;
    }
  | { ok: false; error: string }
> {
  let response: Response;

  try {
    response = await fetch(
      `${config.url}/internal/caterer-email-snapshots`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderRunId,
          catererId,
          actorName,
          reason,
        }),
        cache: "no-store",
      },
    );
  } catch {
    return {
      ok: false,
      error: "The Python backend bridge could not be reached.",
    };
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      error: backendError(
        body,
        "The Python backend rejected the caterer email snapshot request.",
      ),
    };
  }

  const backendResult = backendSnapshotResponseSchema.safeParse(body);

  if (!backendResult.success) {
    return {
      ok: false,
      error: "The Python backend returned an unexpected snapshot response.",
    };
  }

  return { ok: true, data: backendResult.data };
}

export async function createCatererEmailSnapshot(
  input: CreateSnapshotInput,
): Promise<
  CatererEmailActionResult<{
    communicationId: string;
    eventId: string;
    snapshotCreated: boolean;
  }>
> {
  const parsed = createSnapshotSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the email snapshot form.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { operator, error } = await getOperatorClient();

  if (error || !operator) {
    return { ok: false, error: error ?? "Operator access is required." };
  }

  const config = backendConfig();

  if ("error" in config) {
    return { ok: false, error: config.error };
  }

  const bridgeResult = await callSnapshotBridge({
    actorName: operator.display_name,
    catererId: parsed.data.catererId,
    config,
    orderRunId: parsed.data.orderRunId,
    reason: parsed.data.reason,
  });

  if (!bridgeResult.ok) {
    return { ok: false, error: bridgeResult.error };
  }

  revalidateCatererEmailPaths(
    parsed.data.weekStart,
    parsed.data.orderRunId,
    parsed.data.catererId,
  );

  return {
    ok: true,
    data: bridgeResult.data,
    message: bridgeResult.data.snapshotCreated
      ? "Caterer email snapshot created and audited."
      : "Caterer email preparation recorded on the existing snapshot.",
  };
}

export async function createCatererEmailSnapshots(
  input: CreateSnapshotsInput,
): Promise<
  CatererEmailActionResult<{
    created: number;
    reused: number;
    failed: { catererId: string; error: string }[];
  }>
> {
  const parsed = createSnapshotsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the email snapshot form.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { operator, error } = await getOperatorClient();

  if (error || !operator) {
    return { ok: false, error: error ?? "Operator access is required." };
  }

  const config = backendConfig();

  if ("error" in config) {
    return { ok: false, error: config.error };
  }

  let created = 0;
  let reused = 0;
  const failed: { catererId: string; error: string }[] = [];

  for (const catererId of parsed.data.catererIds) {
    const bridgeResult = await callSnapshotBridge({
      actorName: operator.display_name,
      catererId,
      config,
      orderRunId: parsed.data.orderRunId,
      reason: parsed.data.reason,
    });

    if (!bridgeResult.ok) {
      failed.push({ catererId, error: bridgeResult.error });
      continue;
    }

    if (bridgeResult.data.snapshotCreated) {
      created += 1;
    } else {
      reused += 1;
    }
  }

  revalidateCatererEmailPaths(parsed.data.weekStart, parsed.data.orderRunId);

  return {
    ok: true,
    data: { created, reused, failed },
    message:
      failed.length > 0
        ? `${created} snapshot(s) created; ${reused} already existed; ${failed.length} failed.`
        : `${created} snapshot(s) created; ${reused} already existed.`,
  };
}

export async function sendCatererEmails(
  input: SendEmailInput,
): Promise<
  CatererEmailActionResult<{
    sent: z.infer<typeof backendSendItemSchema>[];
    failed: z.infer<typeof backendSendItemSchema>[];
  }>
> {
  const parsed = sendEmailSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the email send form.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { operator, error } = await getOperatorClient();

  if (error || !operator) {
    return { ok: false, error: error ?? "Operator access is required." };
  }

  const config = backendConfig();

  if ("error" in config) {
    return { ok: false, error: config.error };
  }

  let response: Response;

  try {
    response = await fetch(`${config.url}/internal/caterer-email-sends`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderRunId: parsed.data.orderRunId,
        communicationIds: parsed.data.communicationIds,
        actorName: operator.display_name,
        reason: parsed.data.reason,
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
    return {
      ok: false,
      error: backendError(
        body,
        "The Python backend rejected the caterer email send request.",
      ),
    };
  }

  const backendResult = backendSendResponseSchema.safeParse(body);

  if (!backendResult.success) {
    return {
      ok: false,
      error: "The Python backend returned an unexpected send response.",
    };
  }

  revalidateCatererEmailPaths(
    parsed.data.weekStart,
    parsed.data.orderRunId,
  );

  const sentCount = backendResult.data.sent.length;
  const failedCount = backendResult.data.failed.length;

  return {
    ok: true,
    data: backendResult.data,
    message:
      failedCount > 0
        ? `${sentCount} email(s) sent; ${failedCount} send failed.`
        : `${sentCount} caterer email(s) sent and audited.`,
  };
}
