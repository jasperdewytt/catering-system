"use client";

import { useState, useTransition } from "react";

import { submitManagerFeedback } from "@/actions/feedback";
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

type FeedbackContext = Awaited<
  ReturnType<typeof import("@/actions/feedback").getManagerFeedbackContext>
>["data"];

const issueOptions = [
  ["late_delivery", "Late delivery"],
  ["missing_items", "Missing items"],
  ["food_quality", "Food quality"],
  ["student_dislike", "Students disliked it"],
  ["manager_complaint", "Other concern"],
] as const;

type DeliveryStatus =
  | "on_time"
  | "late"
  | "missing_items"
  | "wrong_items"
  | "not_delivered"
  | "unknown";
type LeftoverLevel = "none" | "low" | "moderate" | "high" | "unknown";

export function ManagerFeedbackForm({
  context,
  token,
}: {
  context: NonNullable<FeedbackContext>;
  token: string;
}) {
  const [everythingOk, setEverythingOk] = useState(true);
  const [deliveryStatus, setDeliveryStatus] =
    useState<DeliveryStatus>("on_time");
  const [foodQualityRating, setFoodQualityRating] = useState("5");
  const [leftoverLevel, setLeftoverLevel] = useState<LeftoverLevel>("none");
  const [issueTags, setIssueTags] = useState<string[]>([]);
  const [managerNotes, setManagerNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session catering feedback</CardTitle>
        <CardDescription>
          {context.schoolName}, {context.sessionDateLabel}, catered by{" "}
          {context.catererName}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await submitManagerFeedback({
                token,
                everythingOk,
                deliveryStatus,
                foodQualityRating: Number(foodQualityRating),
                leftoverLevel,
                issueTags,
                managerNotes,
              });
              if (result.ok) {
                setMessage(result.message);
              } else {
                setError(result.error);
              }
            });
          }}
        >
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">
              Was everything okay?
            </legend>
            <div className="flex flex-wrap gap-2">
              <label className="rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-tint">
                <input
                  className="mr-2"
                  type="radio"
                  name="everythingOk"
                  checked={everythingOk}
                  onChange={() => setEverythingOk(true)}
                />
                Yes, all okay
              </label>
              <label className="rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-tint">
                <input
                  className="mr-2"
                  type="radio"
                  name="everythingOk"
                  checked={!everythingOk}
                  onChange={() => setEverythingOk(false)}
                />
                No, record an issue
              </label>
            </div>
          </fieldset>

          {!everythingOk ? (
            <div className="space-y-5 rounded-md border border-border bg-muted p-4">
              <div className="space-y-2">
                <Label htmlFor="deliveryStatus">Delivery status</Label>
                <select
                  id="deliveryStatus"
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={deliveryStatus}
                  onChange={(event) =>
                    setDeliveryStatus(event.target.value as DeliveryStatus)
                  }
                >
                  <option value="late">Late</option>
                  <option value="missing_items">Missing items</option>
                  <option value="wrong_items">Wrong items</option>
                  <option value="not_delivered">Not delivered</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="foodQualityRating">Food quality rating</Label>
                <select
                  id="foodQualityRating"
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={foodQualityRating}
                  onChange={(event) => setFoodQualityRating(event.target.value)}
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="leftoverLevel">Leftover level</Label>
                <select
                  id="leftoverLevel"
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={leftoverLevel}
                  onChange={(event) =>
                    setLeftoverLevel(event.target.value as LeftoverLevel)
                  }
                >
                  <option value="none">None</option>
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">
                  Issue tags
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {issueOptions.map(([value, label]) => (
                    <label key={value} className="text-sm text-foreground">
                      <input
                        className="mr-2"
                        type="checkbox"
                        checked={issueTags.includes(value)}
                        onChange={(event) => {
                          setIssueTags((current) =>
                            event.target.checked
                              ? [...current, value]
                              : current.filter((item) => item !== value),
                          );
                        }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="managerNotes">Notes</Label>
            <Textarea
              id="managerNotes"
              value={managerNotes}
              onChange={(event) => setManagerNotes(event.target.value)}
              placeholder="Anything useful about timing, missing items, quality, or leftovers."
            />
          </div>

          <div aria-live="polite" className="min-h-6 text-sm">
            {error ? <p className="text-[var(--err-fg)]">{error}</p> : null}
            {message ? <p className="text-[var(--ok-fg)]">{message}</p> : null}
          </div>

          <Button type="submit" variant="primary" disabled={isPending || Boolean(message)}>
            {isPending ? "Submitting..." : message ? "Submitted" : "Submit feedback"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
