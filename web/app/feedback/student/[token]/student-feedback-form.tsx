"use client";

import { useState, useTransition } from "react";

import { submitStudentFeedback } from "@/actions/feedback";
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
  ReturnType<typeof import("@/actions/feedback").getStudentFeedbackContext>
>["data"];

export function StudentFeedbackForm({
  context,
  token,
}: {
  context: NonNullable<FeedbackContext>;
  token: string;
}) {
  const [rating, setRating] = useState("5");
  const [freeText, setFreeText] = useState("");
  const [requestedFood, setRequestedFood] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>How was your meal?</CardTitle>
        <CardDescription>
          {context.dishName ?? "Your meal"} from {context.catererName} at{" "}
          {context.schoolName} on {context.sessionDateLabel}.
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
              const result = await submitStudentFeedback({
                token,
                rating: Number(rating),
                freeText,
                requestedFood,
              });
              if (result.ok) {
                setMessage(result.message);
              } else {
                setError(result.error);
              }
            });
          }}
        >
          <fieldset className="space-y-3" aria-describedby="rating-help">
            <legend className="text-sm font-medium text-foreground">
              Rating <span aria-hidden="true">*</span>
            </legend>
            <p id="rating-help" className="text-sm text-muted-foreground">
              Choose 1 for poor and 5 for excellent.
            </p>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center justify-center rounded-md border border-border bg-background p-3 text-sm font-medium has-[:checked]:border-brand has-[:checked]:bg-brand-tint"
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="rating"
                    value={value}
                    checked={rating === String(value)}
                    onChange={(event) => setRating(event.target.value)}
                  />
                  {value}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="freeText">Anything we should know?</Label>
            <Textarea
              id="freeText"
              value={freeText}
              onChange={(event) => setFreeText(event.target.value)}
              placeholder="Too spicy, arrived cold, really good, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="requestedFood">Any food you would like again?</Label>
            <Textarea
              id="requestedFood"
              value={requestedFood}
              onChange={(event) => setRequestedFood(event.target.value)}
              placeholder="Example: chicken burrito bowl"
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
