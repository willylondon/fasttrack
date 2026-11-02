import Link from "next/link";

import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "FastTrack — Delete your account",
  description: "How to permanently delete your FastTrack account and the data associated with it.",
};

export default async function DeleteAccountPage() {
  const session = await auth();

  return (
    <AppShell
      currentPath="/delete-account"
      description="How to permanently delete your FastTrack account and its data."
      providers={authProviders}
      session={session}
      title="Delete your FastTrack account"
    >
      <div className="grid gap-6">
        <Card>
          <CardHeader><CardTitle><h2>Delete it yourself</h2></CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground sm:text-base">
            <ol className="list-decimal space-y-1 pl-5">
              <li>Sign in to FastTrack and open <Link className="text-primary-readable underline underline-offset-4" href="/profile">Profile</Link>.</li>
              <li>Scroll to Delete account and type DELETE to confirm.</li>
              <li>Select Permanently delete account. Deletion happens immediately.</li>
            </ol>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><h2>Can&apos;t sign in?</h2></CardTitle></CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground sm:text-base">
            <p>Email <a className="text-primary-readable underline underline-offset-4" href="mailto:willardwells@gmail.com">willardwells@gmail.com</a> from the address on your account and ask us to delete it. Never send your password.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><h2>What gets deleted</h2></CardTitle></CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground sm:text-base">
            <p>Your sign-in details, profile, avatar, fasting history, check-ins, badges and XP, friend connections, encouragements you sent or received, notifications, push subscriptions, challenges you created and your challenge participation. Challenges you created are removed for other participants too. Guest data stays in your browser until you clear this site&apos;s storage.</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
