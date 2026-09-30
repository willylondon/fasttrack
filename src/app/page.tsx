import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { getAuthErrorMessage } from "@/lib/auth-recovery";
import { FastingTimer } from "@/components/dashboard/fasting-timer";
import { getDashboardData } from "@/lib/fasting-data";

export const metadata = {
  title: "FastTrack — Fasting Window Tracker With Accountability",
  description:
    "Track fasting windows, keep progress locally or in your account, and stay accountable with friends.",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const authError = getAuthErrorMessage((await searchParams).error);
  const session = await auth();
  const dashboard = await getDashboardData(session?.user?.id);

  return (
    <AppShell
      currentPath="/"
      description="Today's fasting window"
      providers={authProviders}
      session={session}
      profile={dashboard.profile}
      title="Today"
    >
      {authError && !session?.user ? (
        <section role="alert" className="mb-5 space-y-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
          <h2 className="font-semibold text-foreground">Let’s get you signed in</h2>
          <p className="text-sm leading-6 text-foreground">{authError}</p>
          <div className="flex flex-wrap items-center gap-3">
            <SignInDialog buttonLabel="Try sign-in again" providers={authProviders} />
            <a href="mailto:willardwells@gmail.com" className="inline-flex min-h-11 items-center text-sm text-primary-readable underline underline-offset-4">Get help with your account</a>
          </div>
        </section>
      ) : null}
      <FastingTimer
        initialData={dashboard}
        signedIn={Boolean(session?.user?.id)}
        userId={session?.user?.id}
      />
    </AppShell>
  );
}
