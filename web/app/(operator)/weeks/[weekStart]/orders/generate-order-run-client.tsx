"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { generateOrderRun } from "@/actions/order-generation";
import { Button } from "@/components/ui/button";
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

const formSchema = z.object({
  weekStart: z.string(),
  reason: z.string().trim().max(500, "Keep the note under 500 characters."),
});

type GenerateOrderRunFormInput = z.infer<typeof formSchema>;

function FieldMessage({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-[var(--err-fg)]">{message}</p>;
}

export function GenerateOrderRunClient({ weekStart }: { weekStart: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [createdRunId, setCreatedRunId] = useState<string | null>(null);
  const form = useForm<GenerateOrderRunFormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: { weekStart, reason: "" },
  });

  function submit(values: GenerateOrderRunFormInput) {
    startTransition(async () => {
      const result = await generateOrderRun(values);

      if (!result.ok) {
        toast.error(result.error);
        form.setError("root", { message: result.error });

        for (const [field, messages] of Object.entries(
          result.fieldErrors ?? {},
        )) {
          const message = messages[0];

          if (message) {
            form.setError(field as keyof GenerateOrderRunFormInput, {
              message,
            });
          }
        }

        return;
      }

      setCreatedRunId(result.data.orderRunId);
      form.reset({ weekStart, reason: "" });
      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="primary">
          <ClipboardList className="size-4" aria-hidden="true" />
          Generate order run
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate order run</DialogTitle>
          <DialogDescription>
            Creates a new persisted run for this week and supersedes prior
            blocked or generated runs. Approved and historical runs are not
            deleted.
          </DialogDescription>
        </DialogHeader>
        {createdRunId ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              The generated run is available for review.
            </p>
            <Button asChild variant="primary">
              <Link href={`/weeks/${weekStart}/orders/${createdRunId}`}>
                Open new run
              </Link>
            </Button>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={form.handleSubmit(submit)}>
            <input type="hidden" {...form.register("weekStart")} />
            <div className="space-y-1">
              <Label htmlFor="generation-note">Optional note</Label>
              <Textarea
                id="generation-note"
                placeholder="Add context for the audit trail."
                {...form.register("reason")}
              />
              <FieldMessage message={form.formState.errors.reason?.message} />
            </div>
            <FieldMessage message={form.formState.errors.root?.message} />
            <Button disabled={isPending} type="submit" variant="primary">
              {isPending ? "Generating" : "Generate run"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
