import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";
import { getLeaderboardData } from "@/lib/fasting-data";

export default async function LeaderboardPage() {
  const session = await auth();
  const leaderboard = await getLeaderboardData(session?.user?.id);

  return (
    <AppShell
      currentPath="/leaderboard"
      description="See who is stacking the most hours, XP, and discipline this week, this month, and all time."
      providers={authProviders}
      session={session}
      title="Leaderboard"
    >
      <LeaderboardView initialData={leaderboard} />
    </AppShell>
  );
}
