"use client";

import QRCode from "qrcode";
import { Copy, ExternalLink, Link2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  getFeedbackRequestLink,
  resetFeedbackDemo,
} from "@/actions/feedback";
import { Button } from "@/components/ui/button";

export function FeedbackToolbar() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await resetFeedbackDemo();
            if (result.ok) {
              toast.success("Feedback links generated.");
              router.refresh();
            } else {
              toast.error(result.error);
            }
          });
        }}
      >
        <Link2 className="size-4" aria-hidden="true" />
        Generate feedback links
      </Button>
    </div>
  );
}

export function FeedbackLinkControl({
  requestId,
  label = "Show link / QR",
}: {
  requestId: string;
  label?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadLink() {
    setError(null);
    const result = await getFeedbackRequestLink(requestId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setUrl(result.data.url);
    setQrDataUrl(
      await QRCode.toDataURL(result.data.url, {
        margin: 1,
        width: 144,
      }),
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            startTransition(loadLink);
          }}
          disabled={isPending}
        >
          {url ? "Refresh link" : label}
        </Button>
        {url ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                toast.success("Feedback link copied.");
              }}
            >
              <Copy className="size-3.5" aria-hidden="true" />
              Copy
            </Button>
            <Button type="button" size="sm" variant="ghost" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" aria-hidden="true" />
                Open
              </a>
            </Button>
          </>
        ) : null}
      </div>
      <div aria-live="polite" className="text-xs text-muted-foreground">
        {error ? <span className="text-[var(--err-fg)]">{error}</span> : null}
        {url ? <span className="break-all">{url}</span> : null}
      </div>
      {qrDataUrl ? (
        <Image
          className="rounded-md border border-border bg-white p-2"
          src={qrDataUrl}
          alt="QR code for the feedback form"
          width={144}
          height={144}
          unoptimized
        />
      ) : null}
    </div>
  );
}
