"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type RunAutopilotActionResult<T = undefined> =
  | { ok: true; data: T; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const weekStartSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date.");

const runAutopilotSchema = z.object({
  freshRun: z.boolean().optional(),
  weekStart: weekStartSchema,
});

const backendAutomationJobResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: z.string(),
  reused: z.boolean(),
});

const resolutionMappingSchema = z.object({
  source_variant_id: z.string().uuid(),
  replacement_variant_id: z.string().uuid(),
});

const resolutionActionSchema = z.object({
  resolution_type: z.enum(["revise_and_reply", "reply_only"]),
  mappings: z.array(resolutionMappingSchema),
  removals: z.array(z.string().uuid()),
});

const resolutionResponseSchema = z.object({
  resolutionId: z.string().uuid(),
  status: z.string(),
  validationReport: z.record(z.string(), z.unknown()),
  resultingOrderRunId: z.string().uuid().nullable(),
  resultingCommunicationId: z.string().uuid().nullable(),
  failureDetail: z.string().nullable(),
});

const generateResolutionSchema = z.object({
  exceptionId: z.string().uuid(),
  instruction: z.string().trim().min(3).max(4000),
  weekStart: weekStartSchema,
});

const editResolutionSchema = z.object({
  resolutionId: z.string().uuid(),
  action: resolutionActionSchema,
  messageText: z.string().trim().min(1).max(10000),
  weekStart: weekStartSchema,
});

const applyResolutionSchema = z.object({
  resolutionId: z.string().uuid(),
  weekStart: weekStartSchema,
});

const dismissExceptionSchema = z.object({
  exceptionId: z.string().uuid(),
  note: z.string().trim().min(3).max(4000),
  weekStart: weekStartSchema,
});

export type RunAutopilotInput = z.infer<typeof runAutopilotSchema>;

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

function backendConfig(): { url: string; secret: string } | { error: string } {
  const url = process.env.PADEA_BACKEND_URL?.replace(/\/+$/, "");
  const secret = process.env.PADEA_BACKEND_SHARED_SECRET;

  if (!url || !secret) {
    return {
      error: "The Python backend bridge is not configured for autopilot runs.",
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

  return "The Python backend rejected the autopilot request.";
}

function revalidateAutopilotPaths(weekStart: string) {
  revalidatePath("/dashboard");
  revalidatePath("/autopilot");
  revalidatePath(`/weeks/${weekStart}`);
  revalidatePath(`/weeks/${weekStart}/orders`);
  revalidatePath(`/weeks/${weekStart}/validation`);
  revalidatePath(`/weeks/${weekStart}/exports`);
  revalidatePath("/audit");
}

async function getOperatorDisplayName(): Promise<
  { displayName: string; id: string } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Sign in as an operator before running autopilot." };
  }

  const { data: operator, error: operatorError } = await supabase
    .from("operators")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (operatorError || !operator) {
    return { error: "Your account is not registered as a Padea operator." };
  }

  return { displayName: operator.display_name as string, id: user.id };
}

async function callResolutionBackend(
  path: string,
  method: "POST" | "PUT",
  body: Record<string, unknown>,
): Promise<
  | { data: z.infer<typeof resolutionResponseSchema>; error: null }
  | { data: null; error: string }
> {
  const config = backendConfig();
  if ("error" in config) {
    return { data: null, error: config.error };
  }

  try {
    const response = await fetch(`${config.url}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return { data: null, error: backendError(value) };
    }
    const parsed = resolutionResponseSchema.safeParse(value);
    if (!parsed.success) {
      return {
        data: null,
        error: "The Python backend returned an unexpected resolution response.",
      };
    }
    return { data: parsed.data, error: null };
  } catch {
    return {
      data: null,
      error: "The Python backend bridge could not be reached.",
    };
  }
}

export async function runAutopilotDemo(
  input: RunAutopilotInput,
): Promise<
  RunAutopilotActionResult<z.infer<typeof backendAutomationJobResponseSchema>>
> {
  const parsed = runAutopilotSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the autopilot request.",
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
    response = await fetch(`${config.url}/internal/automation-jobs/autopilot`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        weekStart: parsed.data.weekStart,
        triggerSource: "manual_demo",
        actorId: operator.id,
        actorName: operator.displayName,
        idempotencyKey: parsed.data.freshRun
          ? `autopilot:${parsed.data.weekStart}:manual_demo:fresh:${crypto.randomUUID()}`
          : `autopilot:${parsed.data.weekStart}:manual_demo`,
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

  const backendResult = backendAutomationJobResponseSchema.safeParse(body);

  if (!backendResult.success) {
    return {
      ok: false,
      error: "The Python backend returned an unexpected autopilot response.",
    };
  }

  revalidateAutopilotPaths(parsed.data.weekStart);

  return {
    ok: true,
    data: backendResult.data,
    message: parsed.data.freshRun
      ? "Fresh autopilot run queued."
      : backendResult.data.reused
        ? "The active autopilot run is already queued."
        : "Autopilot run queued.",
  };
}

export async function generateExceptionResolutionPreview(
  input: z.infer<typeof generateResolutionSchema>,
): Promise<RunAutopilotActionResult<z.infer<typeof resolutionResponseSchema>>> {
  const parsed = generateResolutionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the resolution instruction.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }
  const operator = await getOperatorDisplayName();
  if ("error" in operator) {
    return { ok: false, error: operator.error };
  }
  const result = await callResolutionBackend(
    "/internal/exception-resolution-previews",
    "POST",
    {
      exceptionId: parsed.data.exceptionId,
      operatorInstruction: parsed.data.instruction,
      actorId: operator.id,
      actorName: operator.displayName,
      idempotencyKey: `exception-resolution:${parsed.data.exceptionId}:${crypto.randomUUID()}`,
    },
  );
  if (result.error || !result.data) {
    return { ok: false, error: result.error };
  }
  revalidateAutopilotPaths(parsed.data.weekStart);
  return {
    ok: true,
    data: result.data,
    message: "Resolution preview generated and deterministically validated.",
  };
}

export async function editExceptionResolutionPreview(
  input: z.infer<typeof editResolutionSchema>,
): Promise<RunAutopilotActionResult<z.infer<typeof resolutionResponseSchema>>> {
  const parsed = editResolutionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the edited resolution.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }
  const operator = await getOperatorDisplayName();
  if ("error" in operator) {
    return { ok: false, error: operator.error };
  }
  const result = await callResolutionBackend(
    `/internal/exception-resolution-previews/${parsed.data.resolutionId}`,
    "PUT",
    {
      action: parsed.data.action,
      messageText: parsed.data.messageText,
      actorId: operator.id,
    },
  );
  if (result.error || !result.data) {
    return { ok: false, error: result.error };
  }
  revalidateAutopilotPaths(parsed.data.weekStart);
  return {
    ok: true,
    data: result.data,
    message:
      result.data.status === "ready"
        ? "Preview is ready to apply."
        : "Preview needs edits.",
  };
}

export async function applyExceptionResolutionPreview(
  input: z.infer<typeof applyResolutionSchema>,
): Promise<RunAutopilotActionResult<z.infer<typeof resolutionResponseSchema>>> {
  const parsed = applyResolutionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the apply request." };
  }
  const operator = await getOperatorDisplayName();
  if ("error" in operator) {
    return { ok: false, error: operator.error };
  }
  const result = await callResolutionBackend(
    `/internal/exception-resolution-previews/${parsed.data.resolutionId}/apply`,
    "POST",
    { actorId: operator.id, actorName: operator.displayName },
  );
  if (result.error || !result.data) {
    return { ok: false, error: result.error };
  }
  revalidateAutopilotPaths(parsed.data.weekStart);
  if (result.data.resultingOrderRunId) {
    revalidatePath(
      `/weeks/${parsed.data.weekStart}/orders/${result.data.resultingOrderRunId}`,
    );
  }
  return {
    ok: true,
    data: result.data,
    message: "Resolution applied and response sent in the existing thread.",
  };
}

export async function dismissAutopilotException(
  input: z.infer<typeof dismissExceptionSchema>,
): Promise<RunAutopilotActionResult> {
  const parsed = dismissExceptionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "A dismissal note is required.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }
  const operator = await getOperatorDisplayName();
  if ("error" in operator) {
    return { ok: false, error: operator.error };
  }
  const config = backendConfig();
  if ("error" in config) {
    return { ok: false, error: config.error };
  }
  try {
    const response = await fetch(
      `${config.url}/internal/autopilot-exceptions/${parsed.data.exceptionId}/dismiss`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          note: parsed.data.note,
          actorId: operator.id,
          actorName: operator.displayName,
        }),
        cache: "no-store",
      },
    );
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, error: backendError(value) };
    }
  } catch {
    return {
      ok: false,
      error: "The Python backend bridge could not be reached.",
    };
  }
  revalidateAutopilotPaths(parsed.data.weekStart);
  return {
    ok: true,
    data: undefined,
    message: "Exception dismissed with note.",
  };
}

export async function fetchCatererReplies(
  input: RunAutopilotInput,
): Promise<
  RunAutopilotActionResult<z.infer<typeof backendAutomationJobResponseSchema>>
> {
  const parsed = runAutopilotSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the reply polling request.",
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
    response = await fetch(
      `${config.url}/internal/automation-jobs/caterer-reply-poll`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorId: operator.id,
          actorName: operator.displayName,
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
    return { ok: false, error: backendError(body) };
  }

  const backendResult = backendAutomationJobResponseSchema.safeParse(body);

  if (!backendResult.success) {
    return {
      ok: false,
      error: "The Python backend returned an unexpected reply poll response.",
    };
  }

  revalidateAutopilotPaths(parsed.data.weekStart);

  return {
    ok: true,
    data: backendResult.data,
    message: backendResult.data.reused
      ? "A reply check is already in progress."
      : "Reply check queued.",
  };
}
