import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { FastingTimer } from "@/components/dashboard/fasting-timer";
import { getDashboardData } from "@/lib/fasting-data";

export default async function Home() {
  const session = await auth();
  const dashboard = await getDashboardData(session?.user?.id);

  return (
    <AppShell
      currentPath="/"
      description="A focused dashboard for live timer tracking, stage milestones, and clean session logging."
      providers={authProviders}
      session={session}
      title="Dashboard"
    >
      <FastingTimer initialData={dashboard} userId={session?.user?.id} />
    </AppShell>
  );
}
