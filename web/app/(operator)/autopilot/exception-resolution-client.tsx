"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  applyExceptionResolutionPreview,
  dismissAutopilotException,
  editExceptionResolutionPreview,
  generateExceptionResolutionPreview,
} from "@/actions/autopilot";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { statusToken } from "@/lib/operator-display";
import type {
  OperatorAutopilotException,
  OperatorExceptionResolution,
  OperatorExceptionResolutionOption,
} from "@/lib/operator-read-models";

const instructionSchema = z.object({
  instruction: z.string().trim().min(3, "Describe the intended outcome."),
});

const editSchema = z.object({
  resolution_type: z.enum(["revise_and_reply", "reply_only"]),
  mappings: z.array(
    z.object({
      source_variant_id: z.string().uuid(),
      replacement_variant_id: z.string().uuid(),
    }),
  ),
  removals: z.array(z.string().uuid()),
  messageText: z.string().trim().min(1, "Enter the response to the caterer."),
});

const dismissSchema = z.object({
  note: z.string().trim().min(3, "Record why no action is required."),
});

type EditValues = z.infer<typeof editSchema>;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function initialAction(
  resolution: OperatorExceptionResolution | null,
): EditValues {
  const action = objectValue(resolution?.edited_action);
  const rawMappings = Array.isArray(action.mappings) ? action.mappings : [];
  const mappings = rawMappings.flatMap((value) => {
    const row = objectValue(value);
    return typeof row.source_variant_id === "string" &&
      typeof row.replacement_variant_id === "string"
      ? [
          {
            source_variant_id: row.source_variant_id,
            replacement_variant_id: row.replacement_variant_id,
          },
        ]
      : [];
  });
  return {
    resolution_type:
      action.resolution_type === "revise_and_reply"
        ? "revise_and_reply"
        : "reply_only",
    mappings,
    removals: stringArray(action.removals),
    messageText: resolution?.final_message_text ?? "",
  };
}

function validationErrors(resolution: OperatorExceptionResolution): string[] {
  return stringArray(objectValue(resolution.validation_report).errors);
}

export function ExceptionResolutionClient({
  exception,
  options,
  resolution,
  weekStart,
}: {
  exception: OperatorAutopilotException;
  options: OperatorExceptionResolutionOption[];
  resolution: OperatorExceptionResolution | null;
  weekStart: string;
}) {
  const router = useRouter();
  const [isGenerating, startGenerating] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [isApplying, startApplying] = useTransition();
  const [isDismissing, startDismissing] = useTransition();
  const instructionForm = useForm<z.infer<typeof instructionSchema>>({
    resolver: zodResolver(instructionSchema),
    defaultValues: { instruction: "" },
  });
  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: initialAction(resolution),
  });
  const dismissForm = useForm<z.infer<typeof dismissSchema>>({
    resolver: zodResolver(dismissSchema),
    defaultValues: { note: "" },
  });
  const mappings = useFieldArray({
    control: editForm.control,
    name: "mappings",
  });
  const currentItems = useMemo(
    () => options.filter((option) => option.is_current_order_item),
    [options],
  );
  const replacements = useMemo(
    () =>
      options.filter(
        (option) =>
          !option.is_current_order_item &&
          option.is_available &&
          option.is_operator_reviewed,
      ),
    [options],
  );

  useEffect(() => {
    editForm.reset(initialAction(resolution));
  }, [editForm, resolution]);

  function generate(values: z.infer<typeof instructionSchema>) {
    startGenerating(async () => {
      const result = await generateExceptionResolutionPreview({
        exceptionId: exception.exception_id ?? "",
        instruction: values.instruction,
        weekStart,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  function save(values: EditValues) {
    if (!resolution) return;
    startSaving(async () => {
      const result = await editExceptionResolutionPreview({
        resolutionId: resolution.resolution_id ?? "",
        action: {
          resolution_type: values.resolution_type,
          mappings: values.mappings,
          removals: values.removals,
        },
        messageText: values.messageText,
        weekStart,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  function apply() {
    if (!resolution) return;
    startApplying(async () => {
      const result = await applyExceptionResolutionPreview({
        resolutionId: resolution.resolution_id ?? "",
        weekStart,
      });
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  function dismiss(values: z.infer<typeof dismissSchema>) {
    startDismissing(async () => {
      const result = await dismissAutopilotException({
        exceptionId: exception.exception_id ?? "",
        note: values.note,
        weekStart,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4">
      <div>
        <h4 className="font-medium text-foreground">
          Tell Padea how to resolve this
        </h4>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Padea will prepare a preview. Nothing changes or sends until you apply
          a ready preview.
        </p>
      </div>

      {!resolution ? (
        <form
          className="space-y-2"
          onSubmit={instructionForm.handleSubmit(generate)}
        >
          <Label htmlFor={`instruction-${exception.exception_id}`}>
            Desired outcome
          </Label>
          <Textarea
            id={`instruction-${exception.exception_id}`}
            placeholder="Replace both chicken items with the reviewed vegetarian burrito, and explain the revised order."
            {...instructionForm.register("instruction")}
          />
          {instructionForm.formState.errors.instruction ? (
            <p className="text-xs text-[var(--err-fg)]">
              {instructionForm.formState.errors.instruction.message}
            </p>
          ) : null}
          <Button disabled={isGenerating} type="submit">
            {isGenerating ? "Generating preview" : "Generate preview"}
          </Button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={editForm.handleSubmit(save)}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={statusToken(resolution.status)} />
            <span className="text-xs text-muted-foreground">
              Preview generated from: {resolution.operator_instruction}
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`resolution-type-${resolution.resolution_id}`}>
              Resolution type
            </Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              id={`resolution-type-${resolution.resolution_id}`}
              {...editForm.register("resolution_type")}
            >
              <option value="revise_and_reply">Revise order and reply</option>
              <option value="reply_only">Reply only</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Replacement mappings</Label>
              <Button
                onClick={() =>
                  mappings.append({
                    source_variant_id: currentItems[0]?.dish_variant_id ?? "",
                    replacement_variant_id:
                      replacements[0]?.dish_variant_id ?? "",
                  })
                }
                size="sm"
                type="button"
                variant="secondary"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add mapping
              </Button>
            </div>
            {mappings.fields.map((field, index) => (
              <div
                className="grid gap-2 rounded-md border border-border bg-card p-3 md:grid-cols-[1fr_1fr_auto]"
                key={field.id}
              >
                <select
                  aria-label={`Source item ${index + 1}`}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  {...editForm.register(`mappings.${index}.source_variant_id`)}
                >
                  {currentItems.map((option) => (
                    <option
                      key={option.dish_variant_id}
                      value={option.dish_variant_id ?? ""}
                    >
                      {option.display_name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`Replacement item ${index + 1}`}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  {...editForm.register(
                    `mappings.${index}.replacement_variant_id`,
                  )}
                >
                  {replacements.map((option) => (
                    <option
                      key={option.dish_variant_id}
                      value={option.dish_variant_id ?? ""}
                    >
                      {option.display_name}
                    </option>
                  ))}
                </select>
                <Button
                  aria-label={`Remove mapping ${index + 1}`}
                  onClick={() => mappings.remove(index)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Requested removals</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {currentItems.map((option) => (
                <label
                  className="flex items-center gap-2 rounded-md border border-border bg-card p-2 text-sm"
                  key={option.dish_variant_id}
                >
                  <input
                    type="checkbox"
                    value={option.dish_variant_id ?? ""}
                    {...editForm.register("removals")}
                  />
                  {option.display_name}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor={`message-${resolution.resolution_id}`}>
              Outgoing threaded email
            </Label>
            <Textarea
              className="min-h-40"
              id={`message-${resolution.resolution_id}`}
              {...editForm.register("messageText")}
            />
          </div>

          {validationErrors(resolution).length ? (
            <div className="rounded-md border border-[var(--err-border)] bg-[var(--err-bg)] p-3">
              <p className="text-sm font-medium text-[var(--err-fg)]">
                Apply is blocked
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--err-fg)]">
                {validationErrors(resolution).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button disabled={isSaving} type="submit" variant="secondary">
              {isSaving ? "Revalidating" : "Save and revalidate"}
            </Button>
            <Button
              disabled={resolution.status !== "ready" || isApplying}
              onClick={apply}
              type="button"
            >
              <Send className="size-4" aria-hidden="true" />
              {isApplying ? "Applying" : "Apply"}
            </Button>
          </div>
        </form>
      )}

      <details>
        <summary className="cursor-pointer text-sm font-medium text-brand">
          Dismiss with note
        </summary>
        <form
          className="mt-3 space-y-2"
          onSubmit={dismissForm.handleSubmit(dismiss)}
        >
          <Label htmlFor={`dismiss-${exception.exception_id}`}>
            Why no action is required
          </Label>
          <Textarea
            id={`dismiss-${exception.exception_id}`}
            {...dismissForm.register("note")}
          />
          <Button disabled={isDismissing} type="submit" variant="secondary">
            {isDismissing ? "Dismissing" : "Dismiss exception"}
          </Button>
        </form>
      </details>
    </div>
  );
}
