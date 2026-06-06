"use client";

import { Bot, CheckCircle2, Clock3, Inbox, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { fetchCatererReplies, runAutopilotDemo } from "@/actions/autopilot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import type { Json, Tables } from "@/types/supabase";

type AutomationJob = Tables<"operator_automation_jobs">;
type AutomationSchedule = Tables<"operator_automation_schedule">;
type TerminalAutomationJob = AutomationJob & {
  completed_at: string;
  job_id: string;
};

const ACTIVE_STATUSES = new Set(["queued", "running"]);
const RUN_STAGES = [
  ["validating", "Validating week", 10],
  ["generating_orders", "Generating orders", 30],
  ["checking_allocations", "Checking allocations", 50],
  ["approving_run", "Approving run", 65],
  ["preparing_emails", "Preparing emails", 75],
  ["sending_emails", "Sending emails", 85],
  ["finalizing", "Finalizing run", 99],
] as const;

function jsonObject(value: Json | null): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function numberCounter(job: AutomationJob | null, key: string): number | null {
  const value = jsonObject(job?.counters ?? null)[key];
  return typeof value === "number" ? value : null;
}

function numberResult(job: AutomationJob, key: string): number | null {
  const value = jsonObject(job.result)[key];
  return typeof value === "number" ? value : null;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "now";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}:${remainder.toString().padStart(2, "0")}` : `${remainder}s`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function isActive(job: AutomationJob | null): boolean {
  return Boolean(job?.status && ACTIVE_STATUSES.has(job.status));
}

export function RunAutopilotClient({ weekStart }: { weekStart: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [isRunPending, startRunTransition] = useTransition();
  const [isFreshPending, startFreshTransition] = useTransition();
  const [isReplyPending, startReplyTransition] = useTransition();
  const [runJob, setRunJob] = useState<AutomationJob | null>(null);
  const [replyJob, setReplyJob] = useState<AutomationJob | null>(null);
  const [schedule, setSchedule] = useState<AutomationSchedule | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const seenTerminalJobsRef = useRef(new Set<string>());
  const initializedRef = useRef(false);

  const loadState = useCallback(async () => {
    const [runResult, replyResult, scheduleResult] = await Promise.all([
      supabase
        .from("operator_automation_jobs")
        .select("*")
        .eq("job_type", "autopilot_run")
        .eq("week_start", weekStart)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("operator_automation_jobs")
        .select("*")
        .eq("job_type", "caterer_reply_poll")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("operator_automation_schedule")
        .select("*")
        .eq("schedule_key", "caterer_reply_poll")
        .maybeSingle(),
    ]);

    if (!runResult.error) setRunJob(runResult.data);
    if (!replyResult.error) setReplyJob(replyResult.data);
    if (!scheduleResult.error) setSchedule(scheduleResult.data);

    const terminalJobs = [runResult.data, replyResult.data].filter(
      (job): job is TerminalAutomationJob =>
        Boolean(
          job?.job_id &&
            job.completed_at &&
            ["completed", "failed"].includes(job.status ?? ""),
        ),
    );
    const newTerminalJobs = terminalJobs.filter(
      (job) =>
        job.job_id && !seenTerminalJobsRef.current.has(job.job_id),
    );
    if (!initializedRef.current) {
      initializedRef.current = true;
      for (const job of terminalJobs) {
        seenTerminalJobsRef.current.add(job.job_id);
      }
      return;
    }

    for (const job of newTerminalJobs) {
      seenTerminalJobsRef.current.add(job.job_id);
      if (job.status === "failed") {
        toast.error(job.error_detail ?? `${job.stage_label} failed.`);
      } else if (
        job.job_type !== "caterer_reply_poll" ||
        job.trigger_source !== "scheduled"
      ) {
        toast.success(
          job.job_type === "autopilot_run"
            ? "Autopilot run finished."
            : "Reply check finished.",
        );
      } else {
        const processed = numberResult(job, "processed_count") ?? 0;
        if (processed > 0) {
          toast.success(
            `Automatic reply check processed ${processed} new ${
              processed === 1 ? "reply" : "replies"
            }.`,
          );
        }
      }
    }

    if (newTerminalJobs.length > 0) {
      router.refresh();
    }
  }, [router, supabase, weekStart]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadState(), 0);
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void loadState();
    }, 1000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [loadState]);

  function queueRun(freshRun: boolean) {
    const transition = freshRun ? startFreshTransition : startRunTransition;
    transition(async () => {
      const result = await runAutopilotDemo({ freshRun, weekStart });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      await loadState();
    });
  }

  function checkReplies() {
    startReplyTransition(async () => {
      const result = await fetchCatererReplies({ weekStart });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      await loadState();
    });
  }

  const nextCheckSeconds = schedule?.next_check_at
    ? Math.max(0, Math.ceil((new Date(schedule.next_check_at).getTime() - now) / 1000))
    : null;
  const heartbeatAge = schedule?.worker_heartbeat_at
    ? (now - new Date(schedule.worker_heartbeat_at).getTime()) / 1000
    : Number.POSITIVE_INFINITY;
  const workerOffline = schedule !== null && heartbeatAge > 90;
  const runActive = isActive(runJob);
  const replyActive = isActive(replyJob);
  const progress = runJob?.progress_percent ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automation Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={isRunPending || isFreshPending || runActive}
            onClick={() => queueRun(false)}
            variant="primary"
          >
            <Bot className="size-4" aria-hidden="true" />
            {runActive ? "Autopilot running" : isRunPending ? "Queueing run" : "Run current week"}
          </Button>
          <Button
            disabled={isRunPending || isFreshPending || runActive}
            onClick={() => queueRun(true)}
            variant="secondary"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {isFreshPending ? "Queueing fresh run" : "Fresh run"}
          </Button>
          <Button
            disabled={isReplyPending || replyActive}
            onClick={checkReplies}
            variant="secondary"
          >
            <Inbox className="size-4" aria-hidden="true" />
            {replyActive ? "Checking replies" : isReplyPending ? "Queueing check" : "Check now"}
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock3 className="size-4" aria-hidden="true" />
            {nextCheckSeconds === null
              ? "Automatic schedule unavailable"
              : `Next automatic check in ${formatDuration(nextCheckSeconds)}`}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Last successful check: {formatRelative(schedule?.last_success_at ?? null)}</span>
          <span>
            Schedule: every 2 minutes from 7am–9pm Brisbane, otherwise every 10 minutes
          </span>
          {workerOffline ? (
            <span className="font-medium text-[var(--err-fg)]">
              Automation worker appears offline; queued jobs will wait.
            </span>
          ) : (
            <span>Worker active</span>
          )}
        </div>

        {replyActive ? (
          <div className="rounded-md border border-border bg-muted p-3" aria-live="polite">
            <p className="text-sm font-medium text-foreground">{replyJob?.stage_label}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Gmail attempt {numberCounter(replyJob, "attempt") ?? 0} of{" "}
              {numberCounter(replyJob, "maximum_attempts") ?? 4}
              {numberCounter(replyJob, "next_retry_seconds")
                ? ` · next retry in ${numberCounter(replyJob, "next_retry_seconds")}s`
                : ""}
            </p>
          </div>
        ) : null}

        {runJob ? (
          <div
            className="rounded-md border border-border bg-muted p-4"
            aria-busy={runActive}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{runJob.stage_label}</p>
                <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
                  {runJob.status === "queued"
                    ? "Waiting for the automation worker."
                    : runJob.error_detail ?? `${progress}% complete`}
                </p>
              </div>
              <span className="text-sm font-medium text-foreground">{progress}%</span>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-label="Autopilot run progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="h-full rounded-full bg-brand transition-[width] motion-reduce:transition-none"
                style={{ width: `${progress}%` }}
              />
            </div>
            <ol className="mt-4 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
              {RUN_STAGES.map(([code, label, threshold]) => {
                const complete =
                  progress >= threshold || runJob.current_stage === "complete";
                const current = code === runJob.current_stage;
                return (
                  <li
                    className={
                      complete || current ? "text-foreground" : "text-muted-foreground"
                    }
                    key={code}
                  >
                    {complete ? (
                      <CheckCircle2 className="mr-1 inline size-3.5 text-brand" aria-hidden="true" />
                    ) : (
                      <span className="mr-1 inline-block size-3.5 rounded-full border align-middle" />
                    )}
                    {label}
                  </li>
                );
              })}
            </ol>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {numberCounter(runJob, "allocations") !== null ? (
                <span>{numberCounter(runJob, "allocations")} allocations</span>
              ) : null}
              {numberCounter(runJob, "order_lines") !== null ? (
                <span>{numberCounter(runJob, "order_lines")} order lines</span>
              ) : null}
              {numberCounter(runJob, "allocation_issues") !== null ? (
                <span>{numberCounter(runJob, "allocation_issues")} allocation issues</span>
              ) : null}
              {numberCounter(runJob, "emails_prepared") !== null ? (
                <span>{numberCounter(runJob, "emails_prepared")} emails prepared</span>
              ) : null}
              {numberCounter(runJob, "emails_sent") !== null ? (
                <span>{numberCounter(runJob, "emails_sent")} emails sent</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
