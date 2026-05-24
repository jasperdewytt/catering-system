"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, FilePenLine, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  useForm,
  useWatch,
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
import { formatDate, formatStatus } from "@/lib/operator-display";
import type {
  OperatorOrderRunAllocation,
  OperatorOrderRunContact,
  OperatorOrderRunLine,
} from "@/lib/operator-read-models";

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

type ConcernType =
  | "order_run"
  | "allocation"
  | "order_line"
  | "contact"
  | "other";

type ConcernOption = {
  id: string;
  label: string;
  searchText: string;
};

function normalize(value: string) {
  return value.toLowerCase().trim();
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
  allocations,
  canApprove,
  canReopen,
  contacts,
  lines,
  orderRunId,
  status,
  issueCount,
  weekStart,
}: {
  allocations: OperatorOrderRunAllocation[];
  canApprove: boolean;
  canReopen: boolean;
  contacts: OperatorOrderRunContact[];
  lines: OperatorOrderRunLine[];
  orderRunId: string;
  status: string | null;
  issueCount: number;
  weekStart: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [concernType, setConcernType] = useState<ConcernType>("order_run");
  const [entitySearch, setEntitySearch] = useState("");
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
  const selectedEntityId = useWatch({
    control: overrideForm.control,
    name: "entityId",
  });

  const allocationOptions = useMemo<ConcernOption[]>(
    () =>
      allocations
        .filter((allocation) => allocation.allocation_id)
        .map((allocation) => {
          const label = [
            allocation.student_name ?? "Unknown student",
            allocation.school_name ?? "Unknown school",
            formatDate(allocation.session_date),
            allocation.display_name ?? "No allocated dish",
            formatStatus(allocation.allocation_status),
          ].join(" · ");

          return {
            id: allocation.allocation_id as string,
            label,
            searchText: normalize(label),
          };
        }),
    [allocations],
  );
  const lineOptions = useMemo<ConcernOption[]>(
    () =>
      lines
        .filter((line) => line.order_line_id)
        .map((line) => {
          const label = [
            line.caterer_name ?? "Unknown caterer",
            line.school_name ?? "Unknown school",
            formatDate(line.session_date),
            line.display_name ?? "Unknown dish",
            `${line.quantity ?? 0} meal(s)`,
          ].join(" · ");

          return {
            id: line.order_line_id as string,
            label,
            searchText: normalize(label),
          };
        }),
    [lines],
  );
  const contactOptions = useMemo<ConcernOption[]>(
    () =>
      contacts
        .filter((contact) => contact.contact_id)
        .map((contact) => {
          const label = [
            contact.caterer_name ?? "Unknown caterer",
            contact.contact_name ?? "Unnamed contact",
            contact.email ?? "No email",
          ].join(" · ");

          return {
            id: contact.contact_id as string,
            label,
            searchText: normalize(label),
          };
        }),
    [contacts],
  );

  const visibleEntityOptions = useMemo(() => {
    const source =
      concernType === "allocation"
        ? allocationOptions
        : concernType === "order_line"
          ? lineOptions
          : concernType === "contact"
            ? contactOptions
            : [];
    const query = normalize(entitySearch);

    if (!query) {
      return source;
    }

    return source.filter((option) => option.searchText.includes(query));
  }, [
    allocationOptions,
    concernType,
    contactOptions,
    entitySearch,
    lineOptions,
  ]);

  useEffect(() => {
    if (
      concernType !== "allocation" &&
      concernType !== "order_line" &&
      concernType !== "contact"
    ) {
      return;
    }

    if (
      selectedEntityId &&
      visibleEntityOptions.some((option) => option.id === selectedEntityId)
    ) {
      return;
    }

    overrideForm.setValue("entityId", visibleEntityOptions[0]?.id ?? "");
  }, [concernType, overrideForm, selectedEntityId, visibleEntityOptions]);

  function setOverrideConcern(nextConcern: ConcernType) {
    setConcernType(nextConcern);
    setEntitySearch("");

    if (nextConcern === "order_run") {
      overrideForm.setValue("overrideType", "other");
      overrideForm.setValue("entityType", "order_run");
      overrideForm.setValue("entityId", orderRunId);
      return;
    }

    if (nextConcern === "other") {
      overrideForm.setValue("overrideType", "other");
      overrideForm.setValue("entityType", "other");
      overrideForm.setValue("entityId", "");
      return;
    }

    const source =
      nextConcern === "allocation"
        ? allocationOptions
        : nextConcern === "order_line"
          ? lineOptions
          : contactOptions;
    const firstEntityId = source[0]?.id ?? "";

    overrideForm.setValue(
      "overrideType",
      nextConcern === "contact" ? "contact" : nextConcern,
    );
    overrideForm.setValue(
      "entityType",
      nextConcern === "allocation"
        ? "order_allocation"
        : nextConcern === "order_line"
          ? "order_line"
          : "caterer_contact",
    );
    overrideForm.setValue("entityId", firstEntityId);
  }

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
        setOverrideConcern("order_run");
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
          <CardTitle>Record Follow-Up Note</CardTitle>
          <CardDescription>
            Audits a note for follow-up. It does not change meals, allocations,
            or order quantities.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={overrideForm.handleSubmit(submitOverride)}
          >
            <input type="hidden" {...overrideForm.register("overrideType")} />
            <input type="hidden" {...overrideForm.register("entityType")} />
            <input type="hidden" {...overrideForm.register("entityId")} />
            <div className="space-y-1">
              <Label htmlFor="override-concern">This concerns</Label>
              <select
                className="h-10 w-full rounded-[var(--radius)] border border-input bg-card px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-ring/20"
                id="override-concern"
                onChange={(event) =>
                  setOverrideConcern(event.target.value as ConcernType)
                }
                value={concernType}
              >
                <option value="order_run">Whole order run</option>
                <option value="allocation">Student allocation</option>
                <option value="order_line">Order line</option>
                <option value="contact">Caterer contact</option>
                <option value="other">Other</option>
              </select>
            </div>
            {concernType === "allocation" ||
            concernType === "order_line" ||
            concernType === "contact" ? (
              <div className="space-y-1">
                <Label htmlFor="entity-search">Find row</Label>
                <Input
                  id="entity-search"
                  onChange={(event) => setEntitySearch(event.target.value)}
                  placeholder="Search by student, caterer, school, meal, or email"
                  value={entitySearch}
                />
              </div>
            ) : null}
            {concernType === "allocation" ||
            concernType === "order_line" ||
            concernType === "contact" ? (
              <div className="space-y-1">
                <Label htmlFor="entity-choice">Affected row</Label>
                <select
                  className="h-10 w-full rounded-[var(--radius)] border border-input bg-card px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-ring/20"
                  id="entity-choice"
                  onChange={(event) =>
                    overrideForm.setValue("entityId", event.target.value)
                  }
                  value={selectedEntityId ?? ""}
                >
                  {visibleEntityOptions.length ? (
                    visibleEntityOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))
                  ) : (
                    <option value="">No matching rows</option>
                  )}
                </select>
                <FieldMessage
                  message={overrideForm.formState.errors.entityId?.message}
                />
              </div>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="override-reason">Reason</Label>
              <Textarea
                id="override-reason"
                placeholder="Describe what needs follow-up and why."
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
              {isPending ? "Recording" : "Record follow-up note"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
