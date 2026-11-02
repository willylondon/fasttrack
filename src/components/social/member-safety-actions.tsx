"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate", label: "Hate speech" },
  { value: "sexual", label: "Sexual content" },
  { value: "self_harm", label: "Encourages self-harm or unsafe fasting" },
  { value: "spam", label: "Spam" },
  { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Something else" },
] as const;

type MemberSafetyActionsProps = {
  userId: string;
  displayName?: string | null;
  contentType?: "profile" | "encouragement" | "challenge";
  contentId?: string;
  triggerLabel?: string;
};

async function sendJson(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Something went wrong. Please try again.");
  }
}

export function MemberSafetyActions({
  userId,
  displayName,
  contentType = "profile",
  contentId,
  triggerLabel = "Report or block",
}: MemberSafetyActionsProps) {
  const router = useRouter();
  const name = displayName ?? "this member";
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<void>, success: string) {
    setPending(true);

    try {
      await action();
      toast.success(success);
      setOpen(false);
      setReason("");
      setDetails("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const report = () =>
    run(
      () => sendJson("/api/safety/reports", "POST", { reportedUserId: userId, reason, details, contentType, contentId }),
      "Report sent. Thank you for letting us know."
    );

  const block = () => {
    if (!window.confirm(`Block ${name}? You will stop seeing each other, any friend connection ends, and encouragements between you are deleted.`)) {
      return;
    }

    void run(() => sendJson("/api/safety/blocks", "POST", { targetUserId: userId }), `${name} is blocked.`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" type="button" variant="ghost" />}>{triggerLabel}</DialogTrigger>
      <DialogContent>
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Report or block {name}</DialogTitle>
          <DialogDescription>Reports are private. The person you report is not told who sent it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-6 pb-6">
          <label className="block text-sm font-medium text-foreground" htmlFor={`report-reason-${userId}`}>Reason</label>
          <select
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
            disabled={pending}
            id={`report-reason-${userId}`}
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          >
            <option value="">Choose a reason</option>
            {REASONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <label className="block text-sm font-medium text-foreground" htmlFor={`report-details-${userId}`}>Details (optional)</label>
          <Textarea
            disabled={pending}
            id={`report-details-${userId}`}
            maxLength={500}
            onChange={(event) => setDetails(event.target.value)}
            value={details}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={pending || !reason} onClick={() => void report()} type="button">Send report</Button>
            <Button disabled={pending} onClick={block} type="button" variant="destructive">Block {name}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
