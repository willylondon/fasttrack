import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { FastingTimer } from "@/components/dashboard/fasting-timer";
import { getDashboardData } from "@/lib/fasting-data";

export const metadata = {
  title: "FastTrack — Dashboard",
  description:
    "Start a fasting window, follow your milestones, and keep your progress saved across your account.",
};

export default async function Home() {
  const session = await auth();
  const dashboard = await getDashboardData(session?.user?.id);

  return (
    <AppShell
      currentPath="/"
      description="Start a session, follow your milestones, and keep your progress saved across your account."
      providers={authProviders}
      session={session}
      title="Your fasting window is ready."
    >
      <FastingTimer
        initialData={dashboard}
        providers={authProviders}
        signedIn={Boolean(session?.user?.id)}
        userId={session?.user?.id}
      />
    </AppShell>
  );
}
