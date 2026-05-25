"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, type Path, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  recordCatererEmailPreparation,
  type CatererEmailActionResult,
  type RecordPreparationInput,
} from "@/actions/caterer-emails";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const preparationFormSchema = z.object({
  weekStart: z.string(),
  orderRunId: z.string().uuid(),
  communicationId: z.string().uuid(),
  reason: z.string().trim().min(10, "Enter at least 10 characters."),
});

function applyActionResult(
  form: UseFormReturn<RecordPreparationInput>,
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
      form.setError(field as Path<RecordPreparationInput>, { message });
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
