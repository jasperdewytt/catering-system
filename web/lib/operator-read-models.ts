import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables } from "@/types/supabase";

type OperatorSupabaseClient = SupabaseClient<Database>;

export type OperatorProfile = Pick<Tables<"operators">, "display_name">;
export type OperatorCurrentWeek = Tables<"operator_current_week">;
export type OperatorWeek = Tables<"operator_weeks">;
export type OperatorWeekStatus = Tables<"operator_week_status">;
export type OperatorWeekSession = Tables<"operator_week_sessions">;
export type OperatorCommunication = Tables<"operator_communications">;
export type OperatorCommunicationRecipient =
  Tables<"operator_communication_recipients">;
export type OperatorCommunicationEvent =
  Tables<"operator_communication_events">;
export type OperatorOrderRun = Tables<"operator_order_runs">;
export type OperatorOrderRunLine = Tables<"operator_order_run_lines">;
export type OperatorOrderRunAllocation =
  Tables<"operator_order_run_allocations">;
export type OperatorOrderRunIssue = Tables<"operator_order_run_issues">;
export type OperatorOrderRunContact = Tables<"operator_order_run_contacts">;
export type OperatorManualOverride = Tables<"operator_manual_overrides">;
export type OperatorAuditEvent = Tables<"operator_audit_events">;
export type OperatorMenuSetupRow = Tables<"operator_menu_setup">;
export type OperatorValidationSummary = Tables<"operator_validation_summary">;
export type OperatorCaterer = Tables<"operator_caterers">;
export type OperatorCatererDetail = Tables<"operator_caterer_detail">;
export type OperatorStudent = Tables<"operator_students">;
export type OperatorStudentDetail = Tables<"operator_student_detail">;

export type ReadModelResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

function readError(context: string, error: unknown): string {
  console.error(context, error);
  return `${context} is unavailable. Check operator access and the Phase 4 read models.`;
}

export async function getOperatorProfile(
  supabase: OperatorSupabaseClient,
  userId: string,
): Promise<ReadModelResult<OperatorProfile | null>> {
  const { data, error } = await supabase
    .from("operators")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { data: null, error: readError("Operator profile", error) };
  }

  return { data, error: null };
}

export async function getDashboardReadModel(
  supabase: OperatorSupabaseClient,
): Promise<
  ReadModelResult<{
    currentWeek: OperatorCurrentWeek | null;
    weekStatus: OperatorWeekStatus | null;
    sessions: OperatorWeekSession[];
    latestOrderRun: OperatorOrderRun | null;
    auditEvents: OperatorAuditEvent[];
  }>
> {
  const { data: currentWeek, error: currentWeekError } = await supabase
    .from("operator_current_week")
    .select("*")
    .maybeSingle();

  if (currentWeekError) {
    return {
      data: null,
      error: readError("Current week", currentWeekError),
    };
  }

  if (!currentWeek?.week_start) {
    return {
      data: {
        currentWeek: currentWeek ?? null,
        weekStatus: null,
        sessions: [],
        latestOrderRun: null,
        auditEvents: [],
      },
      error: null,
    };
  }

  const [statusResult, sessionsResult, orderRunsResult, auditResult] =
    await Promise.all([
      supabase
        .from("operator_week_status")
        .select("*")
        .eq("week_start", currentWeek.week_start)
        .maybeSingle(),
      supabase
        .from("operator_week_sessions")
        .select("*")
        .eq("week_start", currentWeek.week_start)
        .order("session_date", { ascending: true })
        .order("school_name", { ascending: true })
        .limit(6),
      supabase
        .from("operator_order_runs")
        .select("*")
        .eq("week_start", currentWeek.week_start)
        .order("generated_at", { ascending: false })
        .limit(1),
      supabase
        .from("operator_audit_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  if (statusResult.error) {
    return { data: null, error: readError("Week status", statusResult.error) };
  }

  if (sessionsResult.error) {
    return {
      data: null,
      error: readError("Week sessions", sessionsResult.error),
    };
  }

  if (orderRunsResult.error) {
    return {
      data: null,
      error: readError("Order runs", orderRunsResult.error),
    };
  }

  if (auditResult.error) {
    return { data: null, error: readError("Audit events", auditResult.error) };
  }

  return {
    data: {
      currentWeek,
      weekStatus: statusResult.data,
      sessions: sessionsResult.data ?? [],
      latestOrderRun: orderRunsResult.data?.[0] ?? null,
      auditEvents: auditResult.data ?? [],
    },
    error: null,
  };
}

export async function getWeeksReadModel(
  supabase: OperatorSupabaseClient,
): Promise<ReadModelResult<OperatorWeek[]>> {
  const { data, error } = await supabase
    .from("operator_weeks")
    .select("*")
    .order("week_start", { ascending: false });

  if (error) {
    return { data: null, error: readError("Service weeks", error) };
  }

  return { data: data ?? [], error: null };
}

export async function getWeekOverviewReadModel(
  supabase: OperatorSupabaseClient,
  weekStart: string,
): Promise<
  ReadModelResult<{
    weekStatus: OperatorWeekStatus | null;
    sessions: OperatorWeekSession[];
    orderRuns: OperatorOrderRun[];
    auditEvents: OperatorAuditEvent[];
  }>
> {
  const [statusResult, sessionsResult, orderRunsResult, auditResult] =
    await Promise.all([
      supabase
        .from("operator_week_status")
        .select("*")
        .eq("week_start", weekStart)
        .maybeSingle(),
      supabase
        .from("operator_week_sessions")
        .select("*")
        .eq("week_start", weekStart)
        .order("session_date", { ascending: true })
        .order("school_name", { ascending: true }),
      supabase
        .from("operator_order_runs")
        .select("*")
        .eq("week_start", weekStart)
        .order("generated_at", { ascending: false }),
      supabase
        .from("operator_audit_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

  if (statusResult.error) {
    return { data: null, error: readError("Week status", statusResult.error) };
  }

  if (sessionsResult.error) {
    return {
      data: null,
      error: readError("Week sessions", sessionsResult.error),
    };
  }

  if (orderRunsResult.error) {
    return {
      data: null,
      error: readError("Order runs", orderRunsResult.error),
    };
  }

  if (auditResult.error) {
    return { data: null, error: readError("Audit events", auditResult.error) };
  }

  const orderRunIds = new Set(
    (orderRunsResult.data ?? [])
      .map((orderRun) => orderRun.order_run_id)
      .filter(Boolean),
  );

  return {
    data: {
      weekStatus: statusResult.data,
      sessions: sessionsResult.data ?? [],
      orderRuns: orderRunsResult.data ?? [],
      auditEvents: (auditResult.data ?? []).filter(
        (event) =>
          !event.order_run_id ||
          (event.order_run_id ? orderRunIds.has(event.order_run_id) : false),
      ),
    },
    error: null,
  };
}

export async function getMenuSetupReadModel(
  supabase: OperatorSupabaseClient,
  weekStart: string,
): Promise<
  ReadModelResult<{
    menuRows: OperatorMenuSetupRow[];
    validationSummary: OperatorValidationSummary[];
  }>
> {
  const [menuResult, validationResult] = await Promise.all([
    supabase
      .from("operator_menu_setup")
      .select("*")
      .eq("week_start", weekStart)
      .order("caterer_name", { ascending: true })
      .order("display_name", { ascending: true }),
    supabase
      .from("operator_validation_summary")
      .select("*")
      .eq("week_start", weekStart)
      .order("severity", { ascending: true })
      .order("category", { ascending: true }),
  ]);

  if (menuResult.error) {
    return { data: null, error: readError("Menu setup", menuResult.error) };
  }

  if (validationResult.error) {
    return {
      data: null,
      error: readError("Menu validation summary", validationResult.error),
    };
  }

  return {
    data: {
      menuRows: menuResult.data ?? [],
      validationSummary: validationResult.data ?? [],
    },
    error: null,
  };
}

export async function getOrdersIndexReadModel(
  supabase: OperatorSupabaseClient,
  weekStart: string,
): Promise<ReadModelResult<{ orderRuns: OperatorOrderRun[] }>> {
  const { data, error } = await supabase
    .from("operator_order_runs")
    .select("*")
    .eq("week_start", weekStart)
    .order("generated_at", { ascending: false });

  if (error) {
    return { data: null, error: readError("Order runs", error) };
  }

  return { data: { orderRuns: data ?? [] }, error: null };
}

export async function getValidationReadModel(
  supabase: OperatorSupabaseClient,
  weekStart: string,
): Promise<
  ReadModelResult<{
    weekStatus: OperatorWeekStatus | null;
    orderRuns: OperatorOrderRun[];
    latestOrderRun: OperatorOrderRun | null;
    validationSummary: OperatorValidationSummary[];
    latestOrderRunIssues: OperatorOrderRunIssue[];
  }>
> {
  const [statusResult, orderRunsResult, validationResult] = await Promise.all([
    supabase
      .from("operator_week_status")
      .select("*")
      .eq("week_start", weekStart)
      .maybeSingle(),
    supabase
      .from("operator_order_runs")
      .select("*")
      .eq("week_start", weekStart)
      .order("generated_at", { ascending: false }),
    supabase
      .from("operator_validation_summary")
      .select("*")
      .eq("week_start", weekStart)
      .order("severity", { ascending: true })
      .order("category", { ascending: true }),
  ]);

  if (statusResult.error) {
    return { data: null, error: readError("Week status", statusResult.error) };
  }

  if (orderRunsResult.error) {
    return {
      data: null,
      error: readError("Order runs", orderRunsResult.error),
    };
  }

  if (validationResult.error) {
    return {
      data: null,
      error: readError("Validation summary", validationResult.error),
    };
  }

  const orderRuns = orderRunsResult.data ?? [];
  const latestOrderRun =
    orderRuns.find((orderRun) => orderRun.is_latest) ?? orderRuns[0] ?? null;

  if (!latestOrderRun?.order_run_id) {
    return {
      data: {
        weekStatus: statusResult.data,
        orderRuns,
        latestOrderRun: null,
        validationSummary: validationResult.data ?? [],
        latestOrderRunIssues: [],
      },
      error: null,
    };
  }

  const { data: issues, error: issuesError } = await supabase
    .from("operator_order_run_issues")
    .select("*")
    .eq("order_run_id", latestOrderRun.order_run_id)
    .order("severity", { ascending: true })
    .order("category", { ascending: true });

  if (issuesError) {
    return {
      data: null,
      error: readError("Latest order-run issues", issuesError),
    };
  }

  return {
    data: {
      weekStatus: statusResult.data,
      orderRuns,
      latestOrderRun,
      validationSummary: validationResult.data ?? [],
      latestOrderRunIssues: issues ?? [],
    },
    error: null,
  };
}

export async function getOrderRunDetailReadModel(
  supabase: OperatorSupabaseClient,
  weekStart: string,
  orderRunId: string,
): Promise<
  ReadModelResult<{
    orderRun: OperatorOrderRun | null;
    lines: OperatorOrderRunLine[];
    allocations: OperatorOrderRunAllocation[];
    issues: OperatorOrderRunIssue[];
    contacts: OperatorOrderRunContact[];
    manualOverrides: OperatorManualOverride[];
    auditEvents: OperatorAuditEvent[];
  }>
> {
  const [
    runResult,
    linesResult,
    allocationsResult,
    issuesResult,
    contactsResult,
    overridesResult,
    auditResult,
  ] = await Promise.all([
    supabase
      .from("operator_order_runs")
      .select("*")
      .eq("week_start", weekStart)
      .eq("order_run_id", orderRunId)
      .maybeSingle(),
    supabase
      .from("operator_order_run_lines")
      .select("*")
      .eq("order_run_id", orderRunId)
      .order("caterer_name", { ascending: true })
      .order("session_date", { ascending: true })
      .order("school_name", { ascending: true })
      .order("display_name", { ascending: true }),
    supabase
      .from("operator_order_run_allocations")
      .select("*")
      .eq("order_run_id", orderRunId)
      .order("session_date", { ascending: true })
      .order("school_name", { ascending: true })
      .order("student_name", { ascending: true }),
    supabase
      .from("operator_order_run_issues")
      .select("*")
      .eq("order_run_id", orderRunId)
      .order("severity", { ascending: true })
      .order("category", { ascending: true }),
    supabase
      .from("operator_order_run_contacts")
      .select("*")
      .eq("order_run_id", orderRunId)
      .order("caterer_name", { ascending: true })
      .order("contact_role", { ascending: true }),
    supabase
      .from("operator_manual_overrides")
      .select("*")
      .eq("order_run_id", orderRunId)
      .order("created_at", { ascending: false }),
    supabase
      .from("operator_audit_events")
      .select("*")
      .eq("order_run_id", orderRunId)
      .order("created_at", { ascending: false }),
  ]);

  if (runResult.error) {
    return { data: null, error: readError("Order run", runResult.error) };
  }

  if (linesResult.error) {
    return { data: null, error: readError("Order lines", linesResult.error) };
  }

  if (allocationsResult.error) {
    return {
      data: null,
      error: readError("Order allocations", allocationsResult.error),
    };
  }

  if (issuesResult.error) {
    return {
      data: null,
      error: readError("Order allocation issues", issuesResult.error),
    };
  }

  if (contactsResult.error) {
    return {
      data: null,
      error: readError("Order run contacts", contactsResult.error),
    };
  }

  if (overridesResult.error) {
    return {
      data: null,
      error: readError("Manual overrides", overridesResult.error),
    };
  }

  if (auditResult.error) {
    return { data: null, error: readError("Audit events", auditResult.error) };
  }

  return {
    data: {
      orderRun: runResult.data,
      lines: linesResult.data ?? [],
      allocations: allocationsResult.data ?? [],
      issues: issuesResult.data ?? [],
      contacts: contactsResult.data ?? [],
      manualOverrides: overridesResult.data ?? [],
      auditEvents: auditResult.data ?? [],
    },
    error: null,
  };
}

export async function getCatererEmailsReadModel(
  supabase: OperatorSupabaseClient,
  weekStart: string,
  orderRunId?: string,
): Promise<
  ReadModelResult<{
    orderRuns: OperatorOrderRun[];
    selectedRun: OperatorOrderRun | null;
    communications: OperatorCommunication[];
    recipients: OperatorCommunicationRecipient[];
    events: OperatorCommunicationEvent[];
    auditEvents: OperatorAuditEvent[];
  }>
> {
  const { data: orderRuns, error: orderRunsError } = await supabase
    .from("operator_order_runs")
    .select("*")
    .eq("week_start", weekStart)
    .order("generated_at", { ascending: false });

  if (orderRunsError) {
    return {
      data: null,
      error: readError("Order runs", orderRunsError),
    };
  }

  const runs = orderRuns ?? [];
  const selectedRun =
    runs.find((run) => run.order_run_id === orderRunId) ?? runs[0] ?? null;

  if (!selectedRun?.order_run_id) {
    return {
      data: {
        orderRuns: runs,
        selectedRun: null,
        communications: [],
        recipients: [],
        events: [],
        auditEvents: [],
      },
      error: null,
    };
  }

  const [communicationsResult, recipientsResult, eventsResult, auditResult] =
    await Promise.all([
      supabase
        .from("operator_communications")
        .select("*")
        .eq("order_run_id", selectedRun.order_run_id)
        .order("caterer_name", { ascending: true }),
      supabase
        .from("operator_communication_recipients")
        .select("*")
        .eq("order_run_id", selectedRun.order_run_id)
        .order("caterer_name", { ascending: true })
        .order("recipient_type", { ascending: true }),
      supabase
        .from("operator_communication_events")
        .select("*")
        .eq("order_run_id", selectedRun.order_run_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("operator_audit_events")
        .select("*")
        .eq("order_run_id", selectedRun.order_run_id)
        .in("action", [
          "communication_exported",
          "communication_sent",
          "communication_send_failed",
        ])
        .order("created_at", { ascending: false }),
    ]);

  if (communicationsResult.error) {
    return {
      data: null,
      error: readError("Caterer emails", communicationsResult.error),
    };
  }

  if (recipientsResult.error) {
    return {
      data: null,
      error: readError("Communication recipients", recipientsResult.error),
    };
  }

  if (eventsResult.error) {
    return {
      data: null,
      error: readError("Communication events", eventsResult.error),
    };
  }

  if (auditResult.error) {
    return { data: null, error: readError("Audit events", auditResult.error) };
  }

  return {
    data: {
      orderRuns: runs,
      selectedRun,
      communications: communicationsResult.data ?? [],
      recipients: recipientsResult.data ?? [],
      events: eventsResult.data ?? [],
      auditEvents: auditResult.data ?? [],
    },
    error: null,
  };
}

export async function getAuditReadModel(
  supabase: OperatorSupabaseClient,
): Promise<
  ReadModelResult<{
    auditEvents: OperatorAuditEvent[];
    orderRunWeekStarts: Record<string, string>;
  }>
> {
  const [auditResult, orderRunsResult] = await Promise.all([
    supabase
      .from("operator_audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("operator_order_runs").select("order_run_id, week_start"),
  ]);

  if (auditResult.error) {
    return { data: null, error: readError("Audit events", auditResult.error) };
  }

  if (orderRunsResult.error) {
    return {
      data: null,
      error: readError("Order run audit links", orderRunsResult.error),
    };
  }

  const orderRunWeekStarts = Object.fromEntries(
    (orderRunsResult.data ?? [])
      .filter((run) => run.order_run_id && run.week_start)
      .map((run) => [run.order_run_id as string, run.week_start as string]),
  );

  return {
    data: {
      auditEvents: auditResult.data ?? [],
      orderRunWeekStarts,
    },
    error: null,
  };
}

export async function getCaterersReadModel(
  supabase: OperatorSupabaseClient,
): Promise<ReadModelResult<OperatorCaterer[]>> {
  const { data, error } = await supabase
    .from("operator_caterers")
    .select("*")
    .order("caterer_name", { ascending: true });

  if (error) {
    return { data: null, error: readError("Caterers", error) };
  }

  return { data: data ?? [], error: null };
}

export async function getCatererDetailReadModel(
  supabase: OperatorSupabaseClient,
  catererId: string,
): Promise<ReadModelResult<OperatorCatererDetail | null>> {
  const { data, error } = await supabase
    .from("operator_caterer_detail")
    .select("*")
    .eq("caterer_id", catererId)
    .maybeSingle();

  if (error) {
    return { data: null, error: readError("Caterer detail", error) };
  }

  return { data, error: null };
}

export async function getStudentsReadModel(
  supabase: OperatorSupabaseClient,
): Promise<ReadModelResult<OperatorStudent[]>> {
  const { data, error } = await supabase
    .from("operator_students")
    .select("*")
    .order("school_name", { ascending: true })
    .order("year_level", { ascending: true })
    .order("student_name", { ascending: true });

  if (error) {
    return { data: null, error: readError("Students", error) };
  }

  return { data: data ?? [], error: null };
}

export async function getStudentDetailReadModel(
  supabase: OperatorSupabaseClient,
  studentId: string,
): Promise<ReadModelResult<OperatorStudentDetail | null>> {
  const { data, error } = await supabase
    .from("operator_student_detail")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) {
    return { data: null, error: readError("Student detail", error) };
  }

  return { data, error: null };
}
