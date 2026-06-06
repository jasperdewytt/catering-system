"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type FeedbackActionResult<T = undefined> =
  | { ok: true; data: T; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const backendContextSchema = z.object({
  requestId: z.string().uuid(),
  audience: z.string(),
  status: z.string(),
  schoolName: z.string(),
  sessionDate: z.string(),
  sessionDateLabel: z.string(),
  catererName: z.string(),
  studentName: z.string().nullable(),
  dishName: z.string().nullable(),
  managerName: z.string().nullable(),
  expiresAt: z.string(),
  submittedAt: z.string().nullable(),
});

const submitResponseSchema = z.object({
  requestId: z.string().uuid(),
  feedbackId: z.string().uuid(),
  status: z.string(),
});

const automationJobSchema = z.object({
  jobId: z.string().uuid(),
  status: z.string(),
  reused: z.boolean(),
});

const feedbackLinkSchema = z.object({
  requestId: z.string().uuid(),
  url: z.string().url(),
});

const studentSubmitSchema = z.object({
  token: z.string().min(20),
  rating: z.coerce.number().int().min(1).max(5),
  freeText: z.string().trim().max(4000).optional(),
  requestedFood: z.string().trim().max(1000).optional(),
});

const managerSubmitSchema = z.object({
  token: z.string().min(20),
  everythingOk: z.boolean(),
  deliveryStatus: z
    .enum(["on_time", "late", "missing_items", "wrong_items", "not_delivered", "unknown"])
    .optional(),
  foodQualityRating: z.coerce.number().int().min(1).max(5).optional(),
  leftoverLevel: z.enum(["none", "low", "moderate", "high", "unknown"]).optional(),
  issueTags: z.array(z.string()).default([]),
  managerNotes: z.string().trim().max(4000).optional(),
});

function backendConfig(): { url: string; secret: string } | { error: string } {
  const url = process.env.PADEA_BACKEND_URL?.replace(/\/+$/, "");
  const secret = process.env.PADEA_BACKEND_SHARED_SECRET;
  if (!url || !secret) {
    return { error: "The Python backend bridge is not configured." };
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
  return "The Python backend rejected the feedback request.";
}

async function backendFetch(
  path: string,
  init?: Omit<RequestInit, "headers"> & { headers?: Record<string, string> },
): Promise<{ value: unknown; error: string | null }> {
  const config = backendConfig();
  if ("error" in config) {
    return { value: null, error: config.error };
  }
  try {
    const response = await fetch(`${config.url}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.secret}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return { value: null, error: backendError(value) };
    }
    return { value, error: null };
  } catch {
    return { value: null, error: "The Python backend bridge could not be reached." };
  }
}

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
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
    return { error: "Sign in as an operator before managing feedback." };
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

export async function getStudentFeedbackContext(token: string) {
  const result = await backendFetch(`/internal/feedback/student/${encodeURIComponent(token)}`);
  if (result.error) {
    return { data: null, error: result.error };
  }
  const parsed = backendContextSchema.safeParse(result.value);
  return parsed.success
    ? { data: parsed.data, error: null }
    : { data: null, error: "The backend returned an unexpected feedback link response." };
}

export async function getManagerFeedbackContext(token: string) {
  const result = await backendFetch(`/internal/feedback/session/${encodeURIComponent(token)}`);
  if (result.error) {
    return { data: null, error: result.error };
  }
  const parsed = backendContextSchema.safeParse(result.value);
  return parsed.success
    ? { data: parsed.data, error: null }
    : { data: null, error: "The backend returned an unexpected feedback link response." };
}

export async function submitStudentFeedback(
  input: z.infer<typeof studentSubmitSchema>,
): Promise<FeedbackActionResult<z.infer<typeof submitResponseSchema>>> {
  const parsed = studentSubmitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the feedback form.", fieldErrors: fieldErrors(parsed.error) };
  }
  const result = await backendFetch(
    `/internal/feedback/student/${encodeURIComponent(parsed.data.token)}`,
    {
      method: "POST",
      body: JSON.stringify({
        rating: parsed.data.rating,
        freeText: parsed.data.freeText,
        requestedFood: parsed.data.requestedFood,
      }),
    },
  );
  if (result.error) {
    return { ok: false, error: result.error };
  }
  const body = submitResponseSchema.safeParse(result.value);
  if (!body.success) {
    return { ok: false, error: "The backend returned an unexpected submission response." };
  }
  return { ok: true, data: body.data, message: "Thanks, your meal feedback was recorded." };
}

export async function submitManagerFeedback(
  input: z.infer<typeof managerSubmitSchema>,
): Promise<FeedbackActionResult<z.infer<typeof submitResponseSchema>>> {
  const parsed = managerSubmitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the feedback form.", fieldErrors: fieldErrors(parsed.error) };
  }
  const result = await backendFetch(
    `/internal/feedback/session/${encodeURIComponent(parsed.data.token)}`,
    {
      method: "POST",
      body: JSON.stringify(parsed.data),
    },
  );
  if (result.error) {
    return { ok: false, error: result.error };
  }
  const body = submitResponseSchema.safeParse(result.value);
  if (!body.success) {
    return { ok: false, error: "The backend returned an unexpected submission response." };
  }
  return { ok: true, data: body.data, message: "Thanks, the session feedback was recorded." };
}

export async function queueFeedbackDispatch(): Promise<
  FeedbackActionResult<z.infer<typeof automationJobSchema>>
> {
  const operator = await getOperatorDisplayName();
  if ("error" in operator) {
    return { ok: false, error: operator.error };
  }
  const result = await backendFetch("/internal/automation-jobs/feedback-dispatch", {
    method: "POST",
    body: JSON.stringify({
      actorId: operator.id,
      actorName: operator.displayName,
    }),
  });
  if (result.error) {
    return { ok: false, error: result.error };
  }
  const body = automationJobSchema.safeParse(result.value);
  if (!body.success) {
    return { ok: false, error: "The backend returned an unexpected feedback job response." };
  }
  revalidatePath("/feedback");
  return {
    ok: true,
    data: body.data,
    message: body.data.reused ? "A feedback check is already queued." : "Feedback check queued.",
  };
}

export async function getFeedbackRequestLink(
  requestId: string,
): Promise<FeedbackActionResult<z.infer<typeof feedbackLinkSchema>>> {
  const parsed = z.string().uuid().safeParse(requestId);
  if (!parsed.success) {
    return { ok: false, error: "Feedback request id is invalid." };
  }
  const operator = await getOperatorDisplayName();
  if ("error" in operator) {
    return { ok: false, error: operator.error };
  }
  const result = await backendFetch(`/internal/feedback-requests/${parsed.data}/link`);
  if (result.error) {
    return { ok: false, error: result.error };
  }
  const body = feedbackLinkSchema.safeParse(result.value);
  if (!body.success) {
    return { ok: false, error: "The backend returned an unexpected feedback link response." };
  }
  return { ok: true, data: body.data, message: "Feedback link generated." };
}

export async function resetFeedbackDemo(): Promise<FeedbackActionResult<Record<string, unknown>>> {
  const operator = await getOperatorDisplayName();
  if ("error" in operator) {
    return { ok: false, error: operator.error };
  }
  const result = await backendFetch("/internal/feedback-demo/reset", {
    method: "POST",
    body: JSON.stringify({ actorName: operator.displayName }),
  });
  if (result.error) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/feedback");
  revalidatePath("/autopilot");
  return { ok: true, data: (result.value as Record<string, unknown>) ?? {}, message: "Feedback demo refreshed." };
}
