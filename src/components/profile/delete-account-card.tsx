"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const CONFIRMATION = "DELETE";

function clearLocalFastTrackData() {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("fasttrack.")) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Storage can be unavailable; the account itself is already deleted.
  }
}

export function DeleteAccountCard() {
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting || confirmation !== CONFIRMATION) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Unable to delete your account.");
      }

      clearLocalFastTrackData();
      await signOut({ callbackUrl: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete your account.");
      setDeleting(false);
    }
  }

  return (
    <Card className="section-enter">
      <CardHeader>
        <CardTitle><h2>Delete account</h2></CardTitle>
        <CardDescription>
          Permanently removes your profile, avatar, fasting history, check-ins, friends, challenges you created, messages and notifications. This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="block text-sm font-medium text-foreground" htmlFor="delete-account-confirmation">
          Type {CONFIRMATION} to confirm
        </label>
        <Input
          autoComplete="off"
          disabled={deleting}
          id="delete-account-confirmation"
          onChange={(event) => setConfirmation(event.target.value)}
          value={confirmation}
        />
        <Button
          disabled={deleting || confirmation !== CONFIRMATION}
          onClick={handleDelete}
          type="button"
          variant="destructive"
        >
          {deleting ? "Deleting account..." : "Permanently delete account"}
        </Button>
      </CardContent>
    </Card>
  );
}
