import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isReviewerLoginEnabled } from "@/lib/reviewer-login";

export const metadata: Metadata = {
  title: "FastTrack — App review sign-in",
  robots: { index: false, follow: false },
};

export default async function ReviewerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Read the switch per request; a static build would freeze it at deploy time.
  await connection();

  if (!isReviewerLoginEnabled()) {
    notFound();
  }

  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md items-center px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>App review sign-in</CardTitle>
          <p className="text-sm text-muted-foreground">
            For app store reviewers, using the test account in the review notes. Everyone else can{" "}
            <Link className="underline underline-offset-4" href="/">sign in as usual</Link>.
          </p>
        </CardHeader>
        <CardContent>
          <form action="/api/reviewer-login" className="space-y-3" method="post">
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                Those details didn’t work. Check them, or wait 15 minutes if you’ve tried several times.
              </p>
            ) : null}
            <label className="block space-y-1 text-sm font-medium" htmlFor="reviewer-email">
              <span>Email</span>
              <Input autoComplete="username" id="reviewer-email" name="email" required type="email" />
            </label>
            <label className="block space-y-1 text-sm font-medium" htmlFor="reviewer-password">
              <span>Password</span>
              <Input autoComplete="current-password" id="reviewer-password" name="password" required type="password" />
            </label>
            <Button className="h-11 w-full" type="submit">Sign in</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
