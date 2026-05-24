"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, FilePenLine, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import {
  useForm,
  type FieldValues,
  type Path,
  type UseFormReturn,
} from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  approveOrderRun,
  recordManualOverride,
  reopenOrderRun,
  type ManualOverrideInput,
  type OrderReviewActionResult,
  type OrderRunReasonInput,
} from "@/actions/order-review";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const reasonSchema = z.string().trim().min(10, "Enter at least 10 characters.");

const reasonFormSchema = z.object({
  weekStart: z.string(),
  orderRunId: z.string().uuid(),
  reason: reasonSchema,
});

const overrideFormSchema = reasonFormSchema.extend({
  overrideType: z.enum([
    "allocation",
    "order_line",
    "student_attendance",
    "dietary_resolution",
    "contact",
    "other",
  ]),
  entityType: z.string().trim().min(1, "Choose what the override concerns."),
  entityId: z.string().trim(),
});

function applyActionResult<T extends FieldValues>(
  form: UseFormReturn<T>,
  result: OrderReviewActionResult<unknown>,
): result is Extract<OrderReviewActionResult<unknown>, { ok: true }> {
  if (result.ok) {
    toast.success(result.message);
    return true;
  }

  toast.error(result.error);
  form.setError("root", { message: result.error });

  for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
    const message = messages[0];

    if (message) {
      form.setError(field as Path<T>, { message });
    }
  }

  return false;
}

function FieldMessage({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-[var(--err-fg)]">{message}</p>;
}

function ReasonForm({
  action,
  buttonLabel,
  disabledReason,
  icon,
  onSubmit,
  orderRunId,
  title,
  weekStart,
}: {
  action: "approve" | "reopen";
  buttonLabel: string;
  disabledReason?: string;
  icon: ReactNode;
  onSubmit: (
    values: OrderRunReasonInput,
  ) => Promise<OrderReviewActionResult<unknown>>;
  orderRunId: string;
  title: string;
  weekStart: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<OrderRunReasonInput>({
    resolver: zodResolver(reasonFormSchema),
    defaultValues: { weekStart, orderRunId, reason: "" },
  });

  function submit(values: OrderRunReasonInput) {
    startTransition(async () => {
      const result = await onSubmit(values);

      if (applyActionResult(form, result)) {
        form.reset({ weekStart, orderRunId, reason: "" });
        setIsOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {disabledReason ??
            "Requires an operator reason and writes an audit event."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          className="w-full"
          disabled={Boolean(disabledReason)}
          onClick={() => setIsOpen((value) => !value)}
          type="button"
          variant={action === "approve" ? "primary" : "secondary"}
        >
          {icon}
          {buttonLabel}
        </Button>
        {isOpen && !disabledReason ? (
          <form className="space-y-3" onSubmit={form.handleSubmit(submit)}>
            <div className="space-y-1">
              <Label htmlFor={`${action}-reason`}>Reason</Label>
              <Textarea
                id={`${action}-reason`}
                placeholder="Record the decision basis for the audit trail."
                {...form.register("reason")}
              />
              <FieldMessage message={form.formState.errors.reason?.message} />
            </div>
            <FieldMessage message={form.formState.errors.root?.message} />
            <Button disabled={isPending} type="submit" variant="primary">
              {isPending ? "Saving" : "Save audited action"}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function OrderReviewActionsClient({
  canApprove,
  canReopen,
  orderRunId,
  status,
  issueCount,
  weekStart,
}: {
  canApprove: boolean;
  canReopen: boolean;
  orderRunId: string;
  status: string | null;
  issueCount: number;
  weekStart: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const overrideForm = useForm<ManualOverrideInput>({
    resolver: zodResolver(overrideFormSchema),
    defaultValues: {
      weekStart,
      orderRunId,
      overrideType: "other",
      entityType: "order_run",
      entityId: orderRunId,
      reason: "",
    },
  });

  function submitOverride(values: ManualOverrideInput) {
    startTransition(async () => {
      const result = await recordManualOverride(values);

      if (applyActionResult(overrideForm, result)) {
        overrideForm.reset({
          weekStart,
          orderRunId,
          overrideType: "other",
          entityType: "order_run",
          entityId: orderRunId,
          reason: "",
        });
        router.refresh();
      }
    });
  }

  const approveDisabledReason = !canApprove
    ? status !== "generated"
      ? "Only generated runs can be approved."
      : issueCount > 0
        ? "Resolve persisted allocation issues before approval."
        : "This run cannot be approved."
    : undefined;
  const reopenDisabledReason = !canReopen
    ? "Only approved runs can be reopened."
    : undefined;

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <ReasonForm
        action="approve"
        buttonLabel="Approve run"
        disabledReason={approveDisabledReason}
        icon={<Check className="size-4" aria-hidden="true" />}
        onSubmit={approveOrderRun}
        orderRunId={orderRunId}
        title="Approval"
        weekStart={weekStart}
      />
      <ReasonForm
        action="reopen"
        buttonLabel="Reopen run"
        disabledReason={reopenDisabledReason}
        icon={<RotateCcw className="size-4" aria-hidden="true" />}
        onSubmit={reopenOrderRun}
        orderRunId={orderRunId}
        title="Reopen"
        weekStart={weekStart}
      />
      <Card>
        <CardHeader>
          <CardTitle>Manual Override Intent</CardTitle>
          <CardDescription>
            Records intent only. It does not change generated allocations or
            order lines.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={overrideForm.handleSubmit(submitOverride)}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="override-type">Type</Label>
                <select
                  className="h-10 w-full rounded-[var(--radius)] border border-input bg-card px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-ring/20"
                  id="override-type"
                  {...overrideForm.register("overrideType")}
                >
                  <option value="allocation">Allocation</option>
                  <option value="order_line">Order line</option>
                  <option value="student_attendance">Student attendance</option>
                  <option value="dietary_resolution">Dietary resolution</option>
                  <option value="contact">Contact</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="entity-type">Entity</Label>
                <select
                  className="h-10 w-full rounded-[var(--radius)] border border-input bg-card px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-ring/20"
                  id="entity-type"
                  {...overrideForm.register("entityType")}
                >
                  <option value="order_run">Order run</option>
                  <option value="order_allocation">Allocation</option>
                  <option value="order_line">Order line</option>
                  <option value="student">Student</option>
                  <option value="caterer_contact">Contact</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="entity-id">Entity UUID</Label>
              <Input
                id="entity-id"
                placeholder="Optional UUID for the affected row"
                {...overrideForm.register("entityId")}
              />
              <FieldMessage
                message={overrideForm.formState.errors.entityId?.message}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="override-reason">Reason</Label>
              <Textarea
                id="override-reason"
                placeholder="Describe the intended manual correction."
                {...overrideForm.register("reason")}
              />
              <FieldMessage
                message={overrideForm.formState.errors.reason?.message}
              />
            </div>
            <FieldMessage
              message={overrideForm.formState.errors.root?.message}
            />
            <Button disabled={isPending} type="submit" variant="secondary">
              <FilePenLine className="size-4" aria-hidden="true" />
              {isPending ? "Recording" : "Record intent"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
