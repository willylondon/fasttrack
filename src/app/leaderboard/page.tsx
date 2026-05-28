import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";
import { getLeaderboardData } from "@/lib/fasting-data";

export const metadata = {
  title: "FastTrack — Leaderboard",
  description: "Compare consistency with your friends across weekly, monthly, and all-time FastTrack rankings.",
};

export default async function LeaderboardPage() {
  const session = await auth();
  const leaderboard = await getLeaderboardData(session?.user?.id);

  return (
    <AppShell
      currentPath="/leaderboard"
      description="Rankings are based on consistency, completed windows, and steady habits rather than extreme fasting."
      providers={authProviders}
      session={session}
      title="Consistency over intensity."
    >
      <LeaderboardView
        initialData={leaderboard}
        providers={authProviders}
        signedIn={Boolean(session?.user?.id)}
      />
    </AppShell>
  );
}
