"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck, MailPlus, Send } from "lucide-react";
import { useRouter } from "next/navigation";
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
  createCatererEmailSnapshot,
  recordCatererEmailPreparation,
  sendCatererEmails,
  type CatererEmailActionResult,
  type CreateSnapshotInput,
  type RecordPreparationInput,
  type SendEmailInput,
} from "@/actions/caterer-emails";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const preparationFormSchema = z.object({
  weekStart: z.string(),
  orderRunId: z.string().uuid(),
  communicationId: z.string().uuid(),
  reason: z.string().trim().min(10, "Enter at least 10 characters."),
});

const snapshotFormSchema = z.object({
  weekStart: z.string(),
  orderRunId: z.string().uuid(),
  catererId: z.string().uuid(),
  reason: z.string().trim().min(10, "Enter at least 10 characters."),
});

const sendFormSchema = z.object({
  weekStart: z.string(),
  orderRunId: z.string().uuid(),
  communicationIds: z.array(z.string().uuid()).min(1, "Select at least one email."),
  reason: z.string().trim().min(10, "Enter at least 10 characters."),
});

function applyActionResult<TInput extends FieldValues>(
  form: UseFormReturn<TInput>,
  result: CatererEmailActionResult<unknown>,
): result is Extract<CatererEmailActionResult<unknown>, { ok: true }> {
  if (result.ok) {
    toast.success(result.message);
    return true;
  }

  toast.error(result.error);
  form.setError("root", { message: result.error });

  for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
    const message = messages[0];

    if (message) {
      form.setError(field as Path<TInput>, { message });
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

export function CatererEmailPreparationForm({
  canRecord,
  communicationId,
  disabledReason,
  orderRunId,
  weekStart,
}: {
  canRecord: boolean;
  communicationId: string;
  disabledReason?: string;
  orderRunId: string;
  weekStart: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<RecordPreparationInput>({
    resolver: zodResolver(preparationFormSchema),
    defaultValues: { weekStart, orderRunId, communicationId, reason: "" },
  });

  function submit(values: RecordPreparationInput) {
    startTransition(async () => {
      const result = await recordCatererEmailPreparation(values);

      if (applyActionResult(form, result)) {
        form.reset({ weekStart, orderRunId, communicationId, reason: "" });
        setIsOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preparation Event</CardTitle>
        <CardDescription>
          {disabledReason ??
            "Records another audited email-prepared event for this persisted snapshot."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          className="w-full"
          disabled={!canRecord}
          onClick={() => setIsOpen((value) => !value)}
          type="button"
          variant="primary"
        >
          <MailCheck className="size-4" aria-hidden="true" />
          Record preparation
        </Button>
        {isOpen && canRecord ? (
          <form className="space-y-3" onSubmit={form.handleSubmit(submit)}>
            <div className="space-y-1">
              <Label htmlFor={`email-preparation-${communicationId}`}>
                Reason
              </Label>
              <Textarea
                id={`email-preparation-${communicationId}`}
                placeholder="Record why this email snapshot was prepared or rechecked."
                {...form.register("reason")}
              />
              <FieldMessage message={form.formState.errors.reason?.message} />
            </div>
            <FieldMessage message={form.formState.errors.root?.message} />
            <Button disabled={isPending} type="submit" variant="primary">
              {isPending ? "Saving" : "Save audited event"}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function CatererEmailSnapshotForm({
  canCreate,
  catererId,
  disabledReason,
  orderRunId,
  weekStart,
}: {
  canCreate: boolean;
  catererId: string;
  disabledReason?: string;
  orderRunId: string;
  weekStart: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<CreateSnapshotInput>({
    resolver: zodResolver(snapshotFormSchema),
    defaultValues: { weekStart, orderRunId, catererId, reason: "" },
  });

  function submit(values: CreateSnapshotInput) {
    startTransition(async () => {
      const result = await createCatererEmailSnapshot(values);

      if (applyActionResult(form, result)) {
        form.reset({ weekStart, orderRunId, catererId, reason: "" });
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Email Snapshot</CardTitle>
        <CardDescription>
          {disabledReason ??
            "Calls the Python backend to create the immutable email snapshot and audit event."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form className="space-y-3" onSubmit={form.handleSubmit(submit)}>
          <div className="space-y-1">
            <Label htmlFor={`email-snapshot-${catererId}`}>Reason</Label>
            <Textarea
              disabled={!canCreate}
              id={`email-snapshot-${catererId}`}
              placeholder="Record why this caterer email snapshot is being prepared."
              {...form.register("reason")}
            />
            <FieldMessage message={form.formState.errors.reason?.message} />
          </div>
          <FieldMessage message={form.formState.errors.root?.message} />
          <Button
            className="w-full"
            disabled={!canCreate || isPending}
            type="submit"
            variant="primary"
          >
            <MailPlus className="size-4" aria-hidden="true" />
            {isPending ? "Creating" : "Create email snapshot"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function CatererEmailSendForm({
  buttonLabel,
  canSend,
  communicationIds,
  disabledReason,
  orderRunId,
  scopeLabel,
  weekStart,
}: {
  buttonLabel: string;
  canSend: boolean;
  communicationIds: string[];
  disabledReason?: string;
  orderRunId: string;
  scopeLabel: string;
  weekStart: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<SendEmailInput>({
    resolver: zodResolver(sendFormSchema),
    defaultValues: { weekStart, orderRunId, communicationIds, reason: "" },
  });

  function submit(values: SendEmailInput) {
    startTransition(async () => {
      const payload = {
        ...values,
        weekStart,
        orderRunId,
        communicationIds,
      };
      const result = await sendCatererEmails(payload);

      if (applyActionResult(form, result)) {
        form.reset({ weekStart, orderRunId, communicationIds, reason: "" });
        setIsOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button disabled={!canSend} type="button" variant="primary">
          <Send className="size-4" aria-hidden="true" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Caterer Email</DialogTitle>
          <DialogDescription>
            This is a real send action. For v1, the Python backend must route it
            to the configured test-recipient override, not directly to caterers.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
          <div className="rounded-md border border-border bg-muted p-3 text-sm">
            <div className="font-medium">{scopeLabel}</div>
            <div className="mt-1 text-muted-foreground">
              {disabledReason ??
                `${communicationIds.length} reviewed email(s) will be submitted to the backend send contract.`}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`email-send-${communicationIds.join("-")}`}>
              Reason
            </Label>
            <Textarea
              id={`email-send-${communicationIds.join("-")}`}
              placeholder="Record why this reviewed caterer email is being sent."
              {...form.register("reason")}
            />
            <FieldMessage message={form.formState.errors.reason?.message} />
          </div>
          <FieldMessage
            message={form.formState.errors.communicationIds?.message}
          />
          <FieldMessage message={form.formState.errors.root?.message} />
          <Button disabled={isPending || !canSend} type="submit" variant="primary">
            <Send className="size-4" aria-hidden="true" />
            {isPending ? "Sending" : "Send now"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
