"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Check, CircleOff, Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
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
  createDishVariant,
  reviewDishVariant,
  saveMenuOffers,
  updateDishVariantAvailability,
  type CreateVariantInput,
  type MenuActionResult,
  type ReviewVariantInput,
  type SaveOffersInput,
  type UpdateAvailabilityInput,
} from "@/actions/menu-setup";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { CompactTable, Td, Th } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  formatDateTime,
  formatStatus,
  statusToken,
} from "@/lib/operator-display";
import type {
  OperatorMenuSetupRow,
  OperatorValidationSummary,
} from "@/lib/operator-read-models";
import { cn } from "@/lib/utils";

const reasonSchema = z.string().trim().min(10, "Enter at least 10 characters.");

const flagsSchema = z.object({
  isGlutenFree: z.boolean(),
  isDairyFree: z.boolean(),
  isNutFree: z.boolean(),
  isVegetarianOption: z.boolean(),
  isHalalInferred: z.boolean(),
  containsBeef: z.boolean(),
  containsPork: z.boolean(),
  containsRedMeat: z.boolean(),
  containsFish: z.boolean(),
  containsShellfish: z.boolean(),
  ingredientNotes: z.string().trim().optional(),
  reason: reasonSchema,
});

const reviewSchema = flagsSchema.extend({
  weekStart: z.string(),
  dishVariantId: z.string().uuid(),
});

const createSchema = flagsSchema.extend({
  weekStart: z.string(),
  dishId: z.string().uuid("Choose a dish."),
  variantName: z.string().trim().min(1, "Enter a variant name."),
});

const availabilitySchema = z.object({
  weekStart: z.string(),
  dishVariantId: z.string().uuid(),
  isAvailable: z.boolean(),
  reason: reasonSchema,
});

const offersSchema = z.object({
  weekStart: z.string(),
  catererId: z.string().uuid(),
  dishVariantIds: z
    .array(z.string().uuid())
    .min(1, "Select at least one option."),
  reason: reasonSchema,
});

const flagFields = [
  { key: "isGlutenFree", label: "GF" },
  { key: "isDairyFree", label: "DF" },
  { key: "isNutFree", label: "NF" },
  { key: "isVegetarianOption", label: "VO" },
  { key: "isHalalInferred", label: "Halal" },
  { key: "containsBeef", label: "Beef" },
  { key: "containsPork", label: "Pork" },
  { key: "containsRedMeat", label: "Red meat" },
  { key: "containsFish", label: "Fish" },
  { key: "containsShellfish", label: "Shellfish" },
] as const;

type FlagKey = (typeof flagFields)[number]["key"];

type CatererGroup = {
  catererId: string;
  catererName: string;
  rows: OperatorMenuSetupRow[];
  validOfferCounts: number[];
  currentSelectedCount: number;
  selectedMinimumMeals: number | null;
};

type DishOption = {
  dishId: string;
  dishName: string;
};

function rowFlags(
  row: OperatorMenuSetupRow,
): Pick<ReviewVariantInput, FlagKey> {
  return {
    isGlutenFree: row.is_gluten_free ?? false,
    isDairyFree: row.is_dairy_free ?? false,
    isNutFree: row.is_nut_free ?? false,
    isVegetarianOption: row.is_vegetarian_option ?? false,
    isHalalInferred: row.is_halal_inferred ?? false,
    containsBeef: row.contains_beef ?? false,
    containsPork: row.contains_pork ?? false,
    containsRedMeat: row.contains_red_meat ?? false,
    containsFish: row.contains_fish ?? false,
    containsShellfish: row.contains_shellfish ?? false,
  };
}

function flagLabels(row: OperatorMenuSetupRow): string[] {
  return [
    row.is_gluten_free ? "GF" : null,
    row.is_dairy_free ? "DF" : null,
    row.is_nut_free ? "NF" : null,
    row.is_vegetarian_option ? "VO" : null,
    row.is_halal_inferred ? "Halal" : null,
    row.contains_beef ? "Beef" : null,
    row.contains_pork ? "Pork" : null,
    row.contains_red_meat ? "Red meat" : null,
    row.contains_fish ? "Fish" : null,
    row.contains_shellfish ? "Shellfish" : null,
  ].filter(Boolean) as string[];
}

function applyActionResult<T extends FieldValues>(
  form: UseFormReturn<T>,
  result: MenuActionResult<unknown>,
): result is Extract<MenuActionResult<unknown>, { ok: true }> {
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

function FlagCheckboxes<T extends FieldValues>({
  form,
}: {
  form: UseFormReturn<T>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {flagFields.map((field) => (
        <label
          className="flex min-h-9 items-center gap-2 rounded-md border border-border bg-card px-2 text-sm"
          key={field.key}
        >
          <input
            className="size-4 accent-[var(--padea-crimson)]"
            type="checkbox"
            {...form.register(field.key as Path<T>)}
          />
          <span>{field.label}</span>
        </label>
      ))}
    </div>
  );
}

function ReviewVariantForm({
  row,
  weekStart,
}: {
  row: OperatorMenuSetupRow;
  weekStart: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<ReviewVariantInput>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      weekStart,
      dishVariantId: row.variant_id ?? "",
      ...rowFlags(row),
      ingredientNotes: row.ingredient_notes ?? "",
      reason: "",
    },
  });

  function onSubmit(values: ReviewVariantInput) {
    startTransition(async () => {
      const result = await reviewDishVariant(values);

      if (applyActionResult(form, result)) {
        form.reset({ ...values, reason: "" });
        router.refresh();
      }
    });
  }

  return (
    <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
      <FlagCheckboxes form={form} />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`notes-${row.variant_id}`}>Notes</Label>
          <Textarea
            id={`notes-${row.variant_id}`}
            {...form.register("ingredientNotes")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`reason-${row.variant_id}`}>Reason</Label>
          <Textarea
            id={`reason-${row.variant_id}`}
            placeholder="What changed or what evidence was checked?"
            {...form.register("reason")}
          />
          <FieldMessage message={form.formState.errors.reason?.message} />
        </div>
      </div>
      <FieldMessage message={form.formState.errors.root?.message} />
      <Button disabled={isPending} type="submit" variant="primary">
        <Check className="size-4" aria-hidden="true" />
        Save review
      </Button>
    </form>
  );
}

function AvailabilityForm({
  row,
  weekStart,
}: {
  row: OperatorMenuSetupRow;
  weekStart: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const targetAvailability = !(row.is_available ?? false);
  const form = useForm<UpdateAvailabilityInput>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
      weekStart,
      dishVariantId: row.variant_id ?? "",
      isAvailable: targetAvailability,
      reason: "",
    },
  });

  function onSubmit(values: UpdateAvailabilityInput) {
    startTransition(async () => {
      const result = await updateDishVariantAvailability(values);

      if (applyActionResult(form, result)) {
        form.reset({ ...values, reason: "" });
        router.refresh();
      }
    });
  }

  return (
    <form
      className="grid gap-2 sm:grid-cols-[1fr_auto]"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="space-y-1">
        <Label htmlFor={`availability-reason-${row.variant_id}`}>Reason</Label>
        <Input
          id={`availability-reason-${row.variant_id}`}
          placeholder="Reason for availability change"
          {...form.register("reason")}
        />
        <FieldMessage message={form.formState.errors.reason?.message} />
      </div>
      <Button
        className="self-end"
        disabled={isPending}
        type="submit"
        variant={targetAvailability ? "secondary" : "danger"}
      >
        {targetAvailability ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <CircleOff className="size-4" aria-hidden="true" />
        )}
        {targetAvailability ? "Restore" : "Unavailable"}
      </Button>
      <FieldMessage message={form.formState.errors.root?.message} />
    </form>
  );
}

function OfferSelectionForm({
  group,
  weekStart,
}: {
  group: CatererGroup;
  weekStart: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initialIds = group.rows
    .filter((row) => row.is_offered && row.variant_id)
    .map((row) => row.variant_id as string);
  const form = useForm<SaveOffersInput>({
    resolver: zodResolver(offersSchema),
    defaultValues: {
      weekStart,
      catererId: group.catererId,
      dishVariantIds: initialIds,
      reason: "",
    },
  });
  const selectedIds =
    useWatch({ control: form.control, name: "dishVariantIds" }) ?? [];
  const selectedSet = new Set(selectedIds);
  const validCount = group.validOfferCounts.includes(selectedIds.length);

  function toggleVariant(variantId: string, checked: boolean) {
    const next = checked
      ? Array.from(new Set([...selectedIds, variantId]))
      : selectedIds.filter((id) => id !== variantId);
    form.setValue("dishVariantIds", next, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function onSubmit(values: SaveOffersInput) {
    startTransition(async () => {
      const result = await saveMenuOffers(values);

      if (applyActionResult(form, result)) {
        form.reset({ ...values, reason: "" });
        router.refresh();
      }
    });
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={validCount ? "Ready" : "Blocked"} />
        <span className="text-sm text-muted-foreground">
          {selectedIds.length} selected. Valid counts:{" "}
          {group.validOfferCounts.length
            ? group.validOfferCounts.join(", ")
            : "not configured"}
          .
          {group.selectedMinimumMeals
            ? ` Minimum tier: ${group.selectedMinimumMeals} meals.`
            : ""}
        </span>
      </div>

      <CompactTable>
        <thead>
          <tr>
            <Th className="w-12">Offer</Th>
            <Th>Variant</Th>
            <Th>Status</Th>
            <Th>Flags</Th>
            <Th>Review</Th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((row) => {
            const variantId = row.variant_id ?? "";
            const isSelected = selectedSet.has(variantId);
            const unavailableAndNotSelected = !row.is_available && !isSelected;

            return (
              <tr key={variantId}>
                <Td>
                  <input
                    aria-label={`Offer ${row.display_name ?? "variant"}`}
                    checked={isSelected}
                    className="size-4 accent-[var(--padea-crimson)]"
                    disabled={unavailableAndNotSelected}
                    onChange={(event) =>
                      toggleVariant(variantId, event.target.checked)
                    }
                    type="checkbox"
                  />
                </Td>
                <Td>
                  <div className="font-medium">
                    {row.display_name ?? "Unnamed variant"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {row.dish_name ?? "Unknown dish"} ·{" "}
                    {row.variant_name ?? "Variant"}
                  </div>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge
                      status={row.is_available ? "Ready" : "Blocked"}
                    />
                    <StatusBadge
                      status={row.operator_reviewed ? "Ready" : "Unreviewed"}
                    />
                  </div>
                </Td>
                <Td>
                  <div className="flex max-w-sm flex-wrap gap-1">
                    {flagLabels(row).length ? (
                      flagLabels(row).map((flag) => (
                        <span
                          className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs"
                          key={flag}
                        >
                          {flag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No flags
                      </span>
                    )}
                  </div>
                </Td>
                <Td>
                  <div className="text-xs text-muted-foreground">
                    {row.ingredient_flags_source ?? "unreviewed"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(row.tags_reviewed_at)}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </CompactTable>

      <FieldMessage message={form.formState.errors.dishVariantIds?.message} />

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="space-y-1">
          <Label htmlFor={`offer-reason-${group.catererId}`}>Reason</Label>
          <Input
            id={`offer-reason-${group.catererId}`}
            placeholder="Reason for this caterer offer set"
            {...form.register("reason")}
          />
          <FieldMessage message={form.formState.errors.reason?.message} />
        </div>
        <Button
          className="self-end"
          disabled={isPending}
          type="submit"
          variant="primary"
        >
          <Save className="size-4" aria-hidden="true" />
          Save offers
        </Button>
      </div>
      <FieldMessage message={form.formState.errors.root?.message} />
    </form>
  );
}

function CreateVariantForm({
  dishOptions,
  weekStart,
}: {
  dishOptions: DishOption[];
  weekStart: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<CreateVariantInput>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      weekStart,
      dishId: dishOptions[0]?.dishId ?? "",
      variantName: "",
      isGlutenFree: false,
      isDairyFree: false,
      isNutFree: false,
      isVegetarianOption: false,
      isHalalInferred: false,
      containsBeef: false,
      containsPork: false,
      containsRedMeat: false,
      containsFish: false,
      containsShellfish: false,
      ingredientNotes: "",
      reason: "",
    },
  });

  function onSubmit(values: CreateVariantInput) {
    startTransition(async () => {
      const result = await createDishVariant(values);

      if (applyActionResult(form, result)) {
        form.reset({
          ...values,
          variantName: "",
          ingredientNotes: "",
          reason: "",
        });
        router.refresh();
      }
    });
  }

  return (
    <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="dishId">Parent dish</Label>
          <select
            className="h-10 w-full rounded-[var(--radius)] border border-input bg-card px-3 text-sm text-foreground shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-ring/20"
            id="dishId"
            {...form.register("dishId")}
          >
            {dishOptions.map((dish) => (
              <option key={dish.dishId} value={dish.dishId}>
                {dish.dishName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="variantName">Variant name</Label>
          <Input
            id="variantName"
            placeholder="Chicken, beef, vegetarian..."
            {...form.register("variantName")}
          />
          <FieldMessage message={form.formState.errors.variantName?.message} />
        </div>
      </div>
      <FlagCheckboxes form={form} />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="createNotes">Notes</Label>
          <Textarea id="createNotes" {...form.register("ingredientNotes")} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="createReason">Reason</Label>
          <Textarea
            id="createReason"
            placeholder="Why this concrete variant is needed"
            {...form.register("reason")}
          />
          <FieldMessage message={form.formState.errors.reason?.message} />
        </div>
      </div>
      <FieldMessage message={form.formState.errors.root?.message} />
      <Button
        disabled={isPending || !dishOptions.length}
        type="submit"
        variant="primary"
      >
        <Plus className="size-4" aria-hidden="true" />
        Create variant
      </Button>
    </form>
  );
}

function groupRows(rows: OperatorMenuSetupRow[]): CatererGroup[] {
  const groups = new Map<string, CatererGroup>();

  for (const row of rows) {
    if (!row.caterer_id) {
      continue;
    }

    const current = groups.get(row.caterer_id) ?? {
      catererId: row.caterer_id,
      catererName: row.caterer_name ?? "Unknown caterer",
      rows: [],
      validOfferCounts: row.valid_offer_counts ?? [],
      currentSelectedCount: row.current_selected_count ?? 0,
      selectedMinimumMeals: row.selected_minimum_meals,
    };

    current.rows.push(row);
    groups.set(row.caterer_id, current);
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.catererName.localeCompare(b.catererName),
  );
}

function dishOptions(rows: OperatorMenuSetupRow[]): DishOption[] {
  const options = new Map<string, DishOption>();

  for (const row of rows) {
    if (row.dish_id && row.dish_name) {
      options.set(row.dish_id, {
        dishId: row.dish_id,
        dishName: row.dish_name,
      });
    }
  }

  return Array.from(options.values()).sort((a, b) =>
    a.dishName.localeCompare(b.dishName),
  );
}

export function MenuSetupClient({
  findings,
  rows,
  weekStart,
}: {
  findings: OperatorValidationSummary[];
  rows: OperatorMenuSetupRow[];
  weekStart: string;
}) {
  const groups = useMemo(() => groupRows(rows), [rows]);
  const [activeCatererId, setActiveCatererId] = useState(
    groups[0]?.catererId ?? "",
  );
  const activeGroup =
    groups.find((group) => group.catererId === activeCatererId) ?? groups[0];

  if (!activeGroup) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No menu rows</CardTitle>
          <CardDescription>
            No active caterers or dish variants are visible for this week.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const activeFindings = findings.filter(
    (finding) =>
      !finding.caterer_id || finding.caterer_id === activeGroup.catererId,
  );
  const activeDishOptions = dishOptions(activeGroup.rows);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {groups.map((group) => (
          <Button
            aria-pressed={group.catererId === activeGroup.catererId}
            key={group.catererId}
            onClick={() => setActiveCatererId(group.catererId)}
            type="button"
            variant={
              group.catererId === activeGroup.catererId
                ? "primary"
                : "secondary"
            }
          >
            {group.catererName}
          </Button>
        ))}
      </div>

      {activeFindings.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Menu Readiness Findings</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {activeFindings.map((finding, index) => (
              <div
                className={cn(
                  "rounded-md border p-3 text-sm",
                  finding.severity === "error"
                    ? "border-[var(--err-border)] bg-[var(--err-bg)]"
                    : "border-[var(--warn-border)] bg-[var(--warn-bg)]",
                )}
                key={`${finding.category}-${index}`}
              >
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="size-4" aria-hidden="true" />
                  {formatStatus(finding.category)}
                </div>
                <p className="mt-1 text-muted-foreground">
                  {finding.summary ?? "Finding details unavailable."}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{activeGroup.catererName} Offers</CardTitle>
          <CardDescription>
            Save one audited offer set per caterer. Unavailable variants cannot
            be saved as offers by the database contract.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OfferSelectionForm group={activeGroup} weekStart={weekStart} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Variant Review</CardTitle>
          <CardDescription>
            Review dietary and ingredient flags separately from availability.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeGroup.rows.map((row) => (
            <details
              className="rounded-md border border-border bg-muted p-3"
              key={row.variant_id}
            >
              <summary className="cursor-pointer text-sm font-medium">
                {row.display_name}
                <span className="ml-2">
                  <StatusBadge
                    status={statusToken(row.operator_reviewed ?? false)}
                  />
                </span>
              </summary>
              <div className="mt-3 space-y-4">
                <ReviewVariantForm row={row} weekStart={weekStart} />
                <AvailabilityForm row={row} weekStart={weekStart} />
              </div>
            </details>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create Custom Variant</CardTitle>
          <CardDescription>
            Add a concrete orderable option under an existing caterer dish.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateVariantForm
            dishOptions={activeDishOptions}
            weekStart={weekStart}
          />
        </CardContent>
      </Card>
    </div>
  );
}
