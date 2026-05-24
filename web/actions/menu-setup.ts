"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type MenuActionResult<T = undefined> =
  | { ok: true; data?: T; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const reasonSchema = z.string().trim().min(10, "Enter at least 10 characters.");
const uuidSchema = z.string().uuid("Expected a valid UUID.");
const weekStartSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date.");

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

const createVariantSchema = flagsSchema.extend({
  weekStart: weekStartSchema,
  dishId: uuidSchema,
  variantName: z.string().trim().min(1, "Enter a variant name."),
});

const reviewVariantSchema = flagsSchema.extend({
  weekStart: weekStartSchema,
  dishVariantId: uuidSchema,
});

const updateAvailabilitySchema = z.object({
  weekStart: weekStartSchema,
  dishVariantId: uuidSchema,
  isAvailable: z.boolean(),
  reason: reasonSchema,
});

const saveOffersSchema = z.object({
  weekStart: weekStartSchema,
  catererId: uuidSchema,
  dishVariantIds: z.array(uuidSchema).min(1, "Select at least one option."),
  reason: reasonSchema,
});

export type VariantFlagsInput = z.infer<typeof flagsSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type ReviewVariantInput = z.infer<typeof reviewVariantSchema>;
export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
export type SaveOffersInput = z.infer<typeof saveOffersSchema>;

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

function revalidateMenuPaths(weekStart: string) {
  revalidatePath("/dashboard");
  revalidatePath(`/weeks/${weekStart}`);
  revalidatePath(`/weeks/${weekStart}/menu`);
  revalidatePath("/audit");
}

async function getOperatorClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { supabase, error: "Sign in as an operator before saving changes." };
  }

  const { data: operator, error: operatorError } = await supabase
    .from("operators")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (operatorError || !operator) {
    return {
      supabase,
      error: "Your account is not registered as a Padea operator.",
    };
  }

  return { supabase, error: null };
}

function rpcError(error: { message?: string } | null): string {
  return error?.message ?? "The menu setup write was rejected.";
}

export async function createDishVariant(
  input: CreateVariantInput,
): Promise<MenuActionResult<{ variantId: string }>> {
  const parsed = createVariantSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the variant form.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { supabase, error } = await getOperatorClient();

  if (error) {
    return { ok: false, error };
  }

  const { data, error: rpcCallError } = await supabase.rpc(
    "operator_create_dish_variant",
    {
      p_dish_id: parsed.data.dishId,
      p_variant_name: parsed.data.variantName,
      p_is_gluten_free: parsed.data.isGlutenFree,
      p_is_dairy_free: parsed.data.isDairyFree,
      p_is_nut_free: parsed.data.isNutFree,
      p_is_vegetarian_option: parsed.data.isVegetarianOption,
      p_is_halal_inferred: parsed.data.isHalalInferred,
      p_contains_beef: parsed.data.containsBeef,
      p_contains_pork: parsed.data.containsPork,
      p_contains_red_meat: parsed.data.containsRedMeat,
      p_contains_fish: parsed.data.containsFish,
      p_contains_shellfish: parsed.data.containsShellfish,
      p_ingredient_notes: parsed.data.ingredientNotes ?? "",
      p_reason: parsed.data.reason,
    },
  );

  if (rpcCallError) {
    return { ok: false, error: rpcError(rpcCallError) };
  }

  revalidateMenuPaths(parsed.data.weekStart);

  return {
    ok: true,
    data: { variantId: data },
    message: "Variant created and audited.",
  };
}

export async function reviewDishVariant(
  input: ReviewVariantInput,
): Promise<MenuActionResult<{ variantId: string }>> {
  const parsed = reviewVariantSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the review form.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { supabase, error } = await getOperatorClient();

  if (error) {
    return { ok: false, error };
  }

  const { data, error: rpcCallError } = await supabase.rpc(
    "operator_review_dish_variant",
    {
      p_dish_variant_id: parsed.data.dishVariantId,
      p_is_gluten_free: parsed.data.isGlutenFree,
      p_is_dairy_free: parsed.data.isDairyFree,
      p_is_nut_free: parsed.data.isNutFree,
      p_is_vegetarian_option: parsed.data.isVegetarianOption,
      p_is_halal_inferred: parsed.data.isHalalInferred,
      p_contains_beef: parsed.data.containsBeef,
      p_contains_pork: parsed.data.containsPork,
      p_contains_red_meat: parsed.data.containsRedMeat,
      p_contains_fish: parsed.data.containsFish,
      p_contains_shellfish: parsed.data.containsShellfish,
      p_ingredient_notes: parsed.data.ingredientNotes ?? "",
      p_reason: parsed.data.reason,
    },
  );

  if (rpcCallError) {
    return { ok: false, error: rpcError(rpcCallError) };
  }

  revalidateMenuPaths(parsed.data.weekStart);

  return {
    ok: true,
    data: { variantId: data },
    message: "Variant review saved and audited.",
  };
}

export async function updateDishVariantAvailability(
  input: UpdateAvailabilityInput,
): Promise<MenuActionResult<{ variantId: string }>> {
  const parsed = updateAvailabilitySchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the availability form.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { supabase, error } = await getOperatorClient();

  if (error) {
    return { ok: false, error };
  }

  const { data, error: rpcCallError } = await supabase.rpc(
    "operator_update_dish_variant_availability",
    {
      p_dish_variant_id: parsed.data.dishVariantId,
      p_is_available: parsed.data.isAvailable,
      p_reason: parsed.data.reason,
    },
  );

  if (rpcCallError) {
    return { ok: false, error: rpcError(rpcCallError) };
  }

  revalidateMenuPaths(parsed.data.weekStart);

  return {
    ok: true,
    data: { variantId: data },
    message: "Availability updated and audited.",
  };
}

export async function saveMenuOffers(
  input: SaveOffersInput,
): Promise<MenuActionResult<{ selectedCount: number }>> {
  const parsed = saveOffersSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the offer selection.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { supabase, error } = await getOperatorClient();

  if (error) {
    return { ok: false, error };
  }

  const { data, error: rpcCallError } = await supabase.rpc(
    "operator_save_menu_offers",
    {
      p_week_start: parsed.data.weekStart,
      p_caterer_id: parsed.data.catererId,
      p_dish_variant_ids: parsed.data.dishVariantIds,
      p_reason: parsed.data.reason,
    },
  );

  if (rpcCallError) {
    return { ok: false, error: rpcError(rpcCallError) };
  }

  revalidateMenuPaths(parsed.data.weekStart);

  return {
    ok: true,
    data: { selectedCount: data },
    message: "Menu offers saved and audited.",
  };
}
