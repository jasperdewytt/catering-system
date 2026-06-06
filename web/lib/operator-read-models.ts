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
export type OperatorAiInterpretation = Tables<"operator_ai_interpretations">;
export type OperatorAutopilotException =
  Tables<"operator_autopilot_exceptions">;
export type OperatorAutopilotStatus = Tables<"operator_autopilot_status">;
export type OperatorCatererQualitySignal =
  Tables<"operator_caterer_quality_signals">;
export type OperatorCatererReply = Tables<"operator_caterer_replies">;
export type OperatorFeedbackEvent = Tables<"operator_feedback_events">;
export type OperatorFeedbackOverview = Tables<"operator_feedback_overview">;
export type OperatorFeedbackRequest = Tables<"operator_feedback_requests">;
export type OperatorFeedbackTrend = Tables<"operator_feedback_weekly_trends">;
export type OperatorCatererFeedbackPerformance =
  Tables<"operator_caterer_feedback_performance">;
export type OperatorMealFitSignal = Tables<"operator_meal_fit_signals">;
export type OperatorExceptionResolution =
  Tables<"operator_exception_resolutions">;
export type OperatorExceptionResolutionOption =
  Tables<"operator_exception_resolution_options">;
export type OperatorMenuSetupRow = Tables<"operator_menu_setup">;
export type OperatorValidationSummary = Tables<"operator_validation_summary">;
export type OperatorCaterer = Tables<"operator_caterers">;
export type OperatorCatererDetail = Tables<"operator_caterer_detail">;
export type OperatorStudent = Tables<"operator_students">;
export type OperatorStudentDetail = Tables<"operator_student_detail">;
export type OperatorShellCommunication = Pick<
  OperatorCommunication,
  "email_state" | "order_run_id" | "week_start"
>;

export type ReadModelResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

function readError(context: string, error: unknown): string {
  console.error(context, error);
  return `${context} is unavailable. Check operator access and secure operator data.`;
}

function metadataString(
  metadata: OperatorCatererReply["metadata"],
  key: string,
): string | null {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") {
    return null;
  }

  const value = metadata[key];
  return typeof value === "string" && value ? value : null;
}

export function scopeRepliesToOrderRunChain(
  replies: OperatorCatererReply[],
  anchorOrderRunId: string | null,
): OperatorCatererReply[] {
  if (!replies.length || !anchorOrderRunId) {
    return [];
  }

  const parentByRevisedRun = new Map<string, string>();
  for (const reply of replies) {
    const revisedOrderRunId = metadataString(
      reply.metadata,
      "revised_order_run_id",
    );
    if (revisedOrderRunId && reply.order_run_id) {
      parentByRevisedRun.set(revisedOrderRunId, reply.order_run_id);
    }
  }

  const rootOrderRunId = (orderRunId: string | null): string | null => {
    if (!orderRunId) {
      return null;
    }

    let current = orderRunId;
    const visited = new Set<string>();
    while (parentByRevisedRun.has(current) && !visited.has(current)) {
      visited.add(current);
      current = parentByRevisedRun.get(current) ?? current;
    }
    return current;
  };

  const anchorRoot = rootOrderRunId(anchorOrderRunId);
  if (!anchorRoot) {
    return [];
  }

  return replies.filter(
    (reply) => rootOrderRunId(reply.order_run_id) === anchorRoot,
  );
}

export function scopeExceptionsToCurrentContext(
  exceptions: OperatorAutopilotException[],
  scopedReplies: OperatorCatererReply[],
  currentAutopilotRunId: string | null,
  currentOrderRunId: string | null,
): OperatorAutopilotException[] {
  const visibleReplyIds = new Set(
    scopedReplies
      .map((reply) => reply.reply_id)
      .filter((replyId): replyId is string => Boolean(replyId)),
  );

  return exceptions.filter((exception) => {
    if (
      exception.caterer_reply_id &&
      visibleReplyIds.has(exception.caterer_reply_id)
    ) {
      return true;
    }

    if (currentAutopilotRunId && exception.autopilot_run_id) {
      return exception.autopilot_run_id === currentAutopilotRunId;
    }

    if (currentOrderRunId && exception.order_run_id) {
      return exception.order_run_id === currentOrderRunId;
    }

    return !currentAutopilotRunId && !currentOrderRunId;
  });
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

export async function getShellWorkflowReadModel(
  supabase: OperatorSupabaseClient,
): Promise<
  ReadModelResult<{
    currentWeekStart: string | null;
    weekStatuses: OperatorWeekStatus[];
    communications: OperatorShellCommunication[];
    openExceptionCount: number;
  }>
> {
  const [currentWeekResult, statusesResult, communicationsResult, exceptionsResult] =
    await Promise.all([
      supabase.from("operator_current_week").select("week_start").maybeSingle(),
      supabase.from("operator_week_status").select("*"),
      supabase
        .from("operator_communications")
        .select("week_start,order_run_id,email_state"),
      supabase
        .from("operator_autopilot_exceptions")
        .select("exception_id")
        .eq("status", "open")
        .limit(50),
    ]);

  if (currentWeekResult.error) {
    return {
      data: null,
      error: readError("Current week", currentWeekResult.error),
    };
  }

  if (statusesResult.error) {
    return {
      data: null,
      error: readError("Week status", statusesResult.error),
    };
  }

  if (communicationsResult.error) {
    return {
      data: null,
      error: readError("Caterer emails", communicationsResult.error),
    };
  }

  return {
    data: {
      currentWeekStart: currentWeekResult.data?.week_start ?? null,
      weekStatuses: statusesResult.data ?? [],
      communications: communicationsResult.data ?? [],
      openExceptionCount: exceptionsResult.data?.length ?? 0,
    },
    error: null,
  };
}

export async function getDashboardReadModel(
  supabase: OperatorSupabaseClient,
): Promise<
  ReadModelResult<{
    currentWeek: OperatorCurrentWeek | null;
    weekStatus: OperatorWeekStatus | null;
    sessions: OperatorWeekSession[];
    latestOrderRun: OperatorOrderRun | null;
    autopilotStatus: OperatorAutopilotStatus | null;
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
        autopilotStatus: null,
        auditEvents: [],
      },
      error: null,
    };
  }

  const [
    statusResult,
    sessionsResult,
    orderRunsResult,
    autopilotResult,
    auditResult,
  ] = await Promise.all([
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
      .from("operator_autopilot_status")
      .select("*")
      .eq("week_start", currentWeek.week_start)
      .maybeSingle(),
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

  if (autopilotResult.error) {
    return {
      data: null,
      error: readError("Autopilot status", autopilotResult.error),
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
      autopilotStatus: autopilotResult.data,
      auditEvents: auditResult.data ?? [],
    },
    error: null,
  };
}

export async function getAutopilotReadModel(
  supabase: OperatorSupabaseClient,
): Promise<
  ReadModelResult<{
    currentWeek: OperatorCurrentWeek | null;
    autopilotStatus: OperatorAutopilotStatus | null;
    exceptions: OperatorAutopilotException[];
    replies: OperatorCatererReply[];
    resolutions: OperatorExceptionResolution[];
    resolutionOptions: OperatorExceptionResolutionOption[];
    mealFitSignals: OperatorMealFitSignal[];
    qualitySignals: OperatorCatererQualitySignal[];
    feedbackEvents: OperatorFeedbackEvent[];
    aiInterpretations: OperatorAiInterpretation[];
    timelineEvents: OperatorAuditEvent[];
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
        autopilotStatus: null,
        exceptions: [],
        replies: [],
        resolutions: [],
        resolutionOptions: [],
        mealFitSignals: [],
        qualitySignals: [],
        feedbackEvents: [],
        aiInterpretations: [],
        timelineEvents: [],
      },
      error: null,
    };
  }

  const [statusResult, latestOrderRunResult] = await Promise.all([
    supabase
      .from("operator_autopilot_status")
      .select("*")
      .eq("week_start", currentWeek.week_start)
      .maybeSingle(),
    supabase
      .from("operator_order_runs")
      .select("order_run_id")
      .eq("week_start", currentWeek.week_start)
      .order("generated_at", { ascending: false })
      .limit(1),
  ]);

  if (statusResult.error) {
    return {
      data: null,
      error: readError("Autopilot status", statusResult.error),
    };
  }

  if (latestOrderRunResult.error) {
    return {
      data: null,
      error: readError("Latest order run", latestOrderRunResult.error),
    };
  }

  const autopilotStatus = statusResult.data;
  const latestOrderRunId = latestOrderRunResult.data?.[0]?.order_run_id ?? null;
  const currentOrderRunId =
    autopilotStatus?.generated_order_run_id ?? latestOrderRunId;
  const currentAutopilotRunId = autopilotStatus?.autopilot_run_id ?? null;
  const repliesQuery = supabase
    .from("operator_caterer_replies")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(100);
  const mealFitQuery = supabase
    .from("operator_meal_fit_signals")
    .select("*")
    .not("chosen_score", "is", null)
    .order("chosen_score", { ascending: true })
    .limit(8);

  const [
    exceptionsResult,
    repliesResult,
    mealFitResult,
    qualityResult,
    feedbackResult,
    aiResult,
    resolutionsResult,
    resolutionOptionsResult,
  ] = await Promise.all([
    supabase
      .from("operator_autopilot_exceptions")
      .select("*")
      .eq("week_start", currentWeek.week_start)
      .order("created_at", { ascending: false }),
    repliesQuery.eq("week_start", currentWeek.week_start),
    currentOrderRunId
      ? mealFitQuery.eq("order_run_id", currentOrderRunId)
      : mealFitQuery.eq("week_start", currentWeek.week_start),
    supabase
      .from("operator_caterer_quality_signals")
      .select("*")
      .order("serious_event_count", { ascending: false })
      .order("review_event_count", { ascending: false })
      .order("caterer_name", { ascending: true }),
    supabase
      .from("operator_feedback_events")
      .select("*")
      .gte("session_date", currentWeek.week_start)
      .lte("session_date", currentWeek.week_end ?? currentWeek.week_start)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("operator_ai_interpretations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("operator_exception_resolutions")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("operator_exception_resolution_options")
      .select("*")
      .order("display_name", { ascending: true }),
  ]);

  if (exceptionsResult.error) {
    return {
      data: null,
      error: readError("Autopilot exceptions", exceptionsResult.error),
    };
  }

  if (repliesResult.error) {
    return {
      data: null,
      error: readError("Caterer replies", repliesResult.error),
    };
  }

  if (mealFitResult.error) {
    return {
      data: null,
      error: readError("Meal-fit signals", mealFitResult.error),
    };
  }

  if (qualityResult.error) {
    return {
      data: null,
      error: readError("Caterer quality signals", qualityResult.error),
    };
  }

  if (feedbackResult.error) {
    return {
      data: null,
      error: readError("Feedback events", feedbackResult.error),
    };
  }

  if (aiResult.error) {
    return {
      data: null,
      error: readError("AI interpretations", aiResult.error),
    };
  }
  if (resolutionsResult.error) {
    return {
      data: null,
      error: readError("Exception resolutions", resolutionsResult.error),
    };
  }
  if (resolutionOptionsResult.error) {
    return {
      data: null,
      error: readError("Resolution options", resolutionOptionsResult.error),
    };
  }

  const scopedReplies = scopeRepliesToOrderRunChain(
    repliesResult.data ?? [],
    latestOrderRunId,
  );
  const scopedExceptions = scopeExceptionsToCurrentContext(
    exceptionsResult.data ?? [],
    scopedReplies,
    currentAutopilotRunId,
    currentOrderRunId,
  );
  const auditFilterIds = [
    currentAutopilotRunId,
    currentOrderRunId,
    ...scopedExceptions.map((exception) => exception.exception_id),
  ].filter((value): value is string => Boolean(value));

  let timelineEvents: OperatorAuditEvent[] = [];

  if (auditFilterIds.length) {
    const { data: auditEvents, error: auditError } = await supabase
      .from("operator_audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (auditError) {
      return {
        data: null,
        error: readError("Autopilot timeline", auditError),
      };
    }

    timelineEvents = (auditEvents ?? []).filter(
      (event) =>
        (event.entity_id ? auditFilterIds.includes(event.entity_id) : false) ||
        (event.order_run_id
          ? auditFilterIds.includes(event.order_run_id)
          : false),
    );
  }

  return {
    data: {
      currentWeek,
      autopilotStatus,
      exceptions: scopedExceptions.sort((left, right) => {
        const statusWeight = (value: string | null) =>
          value === "open" ? 0 : 1;
        const severityWeight = (value: string | null) => {
          if (value === "critical") return 0;
          if (value === "blocked") return 1;
          if (value === "review") return 2;
          return 3;
        };

        return (
          statusWeight(left.status) - statusWeight(right.status) ||
          severityWeight(left.severity) - severityWeight(right.severity)
        );
      }),
      replies: scopedReplies,
      resolutions: (resolutionsResult.data ?? []).filter((resolution) =>
        scopedExceptions.some(
          (exception) => exception.exception_id === resolution.exception_id,
        ),
      ),
      resolutionOptions: (resolutionOptionsResult.data ?? []).filter((option) =>
        scopedExceptions.some(
          (exception) => exception.exception_id === option.exception_id,
        ),
      ),
      mealFitSignals: mealFitResult.data ?? [],
      qualitySignals: qualityResult.data ?? [],
      feedbackEvents: feedbackResult.data ?? [],
      aiInterpretations: aiResult.data ?? [],
      timelineEvents,
    },
    error: null,
  };
}

export async function getFeedbackReadModel(
  supabase: OperatorSupabaseClient,
): Promise<
  ReadModelResult<{
    currentWeek: OperatorCurrentWeek | null;
    overview: OperatorFeedbackOverview[];
    trends: OperatorFeedbackTrend[];
    caterers: OperatorCatererFeedbackPerformance[];
    requests: OperatorFeedbackRequest[];
    events: OperatorFeedbackEvent[];
    qualitySignals: OperatorCatererQualitySignal[];
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

  const [
    overviewResult,
    trendsResult,
    caterersResult,
    requestsResult,
    eventsResult,
    qualityResult,
  ] = await Promise.all([
    supabase
      .from("operator_feedback_overview")
      .select("*")
      .order("week_start", { ascending: false })
      .limit(8),
    supabase
      .from("operator_feedback_weekly_trends")
      .select("*")
      .order("week_start", { ascending: true })
      .limit(12),
    supabase
      .from("operator_caterer_feedback_performance")
      .select("*")
      .order("serious_quality_event_count", { ascending: false })
      .order("review_quality_event_count", { ascending: false })
      .order("caterer_name", { ascending: true }),
    supabase
      .from("operator_feedback_requests")
      .select("*")
      .order("eligible_at", { ascending: false })
      .limit(80),
    supabase
      .from("operator_feedback_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("operator_caterer_quality_signals")
      .select("*")
      .order("serious_event_count", { ascending: false })
      .order("review_event_count", { ascending: false })
      .order("caterer_name", { ascending: true }),
  ]);

  if (overviewResult.error) {
    return {
      data: null,
      error: readError("Feedback overview", overviewResult.error),
    };
  }
  if (trendsResult.error) {
    return {
      data: null,
      error: readError("Feedback trends", trendsResult.error),
    };
  }
  if (caterersResult.error) {
    return {
      data: null,
      error: readError("Caterer feedback performance", caterersResult.error),
    };
  }
  if (requestsResult.error) {
    return {
      data: null,
      error: readError("Feedback requests", requestsResult.error),
    };
  }
  if (eventsResult.error) {
    return {
      data: null,
      error: readError("Feedback events", eventsResult.error),
    };
  }
  if (qualityResult.error) {
    return {
      data: null,
      error: readError("Quality signals", qualityResult.error),
    };
  }

  return {
    data: {
      currentWeek: currentWeek ?? null,
      overview: overviewResult.data ?? [],
      trends: trendsResult.data ?? [],
      caterers: caterersResult.data ?? [],
      requests: requestsResult.data ?? [],
      events: eventsResult.data ?? [],
      qualitySignals: qualityResult.data ?? [],
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
