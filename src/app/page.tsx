import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { FastingTimer } from "@/components/dashboard/fasting-timer";
import { getDashboardData } from "@/lib/fasting-data";

export const metadata = {
  title: "FastTrack — Dashboard",
  description:
    "Track your fasting window, keep your streak steady, and save progress across your account.",
};

export default async function Home() {
  const session = await auth();
  const dashboard = await getDashboardData(session?.user?.id);

  return (
    <AppShell
      currentPath="/"
      description="Build your streak. Track your window. Stay accountable."
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
