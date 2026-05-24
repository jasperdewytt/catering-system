import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables } from "@/types/supabase";

type OperatorSupabaseClient = SupabaseClient<Database>;

export type OperatorProfile = Pick<Tables<"operators">, "display_name">;
export type OperatorCurrentWeek = Tables<"operator_current_week">;
export type OperatorWeek = Tables<"operator_weeks">;
export type OperatorWeekStatus = Tables<"operator_week_status">;
export type OperatorWeekSession = Tables<"operator_week_sessions">;
export type OperatorOrderRun = Tables<"operator_order_runs">;
export type OperatorAuditEvent = Tables<"operator_audit_events">;
export type OperatorMenuSetupRow = Tables<"operator_menu_setup">;
export type OperatorValidationSummary = Tables<"operator_validation_summary">;

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
