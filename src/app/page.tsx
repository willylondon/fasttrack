import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { FastingTimer } from "@/components/dashboard/fasting-timer";
import { getDashboardData } from "@/lib/fasting-data";

export const metadata = {
  title: "FastTrack — Fasting Window Tracker With Accountability",
  description:
    "Track fasting windows, keep progress locally or in your account, and stay accountable with friends.",
};

export default async function Home() {
  const session = await auth();
  const dashboard = await getDashboardData(session?.user?.id);

  return (
    <AppShell
      currentPath="/"
      description="Today's fasting window"
      providers={authProviders}
      session={session}
      title="Today"
    >
      <FastingTimer
        initialData={dashboard}
        signedIn={Boolean(session?.user?.id)}
        userId={session?.user?.id}
      />
    </AppShell>
  );
}
