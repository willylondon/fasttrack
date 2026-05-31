import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { ChallengesView } from "@/components/challenges/challenges-view";
import { getChallengesListData } from "@/lib/fasting-data";

export const metadata = {
  title: "FastTrack — Challenges",
  description: "Join time-bound fasting challenges, compete with friends, and earn badges along the way.",
};

export default async function ChallengesPage() {
  const session = await auth();
  const challenges = await getChallengesListData(session?.user?.id);

  return (
    <AppShell
      currentPath="/challenges"
      description="Set goals, track progress against your circle, and keep each other accountable."
      providers={authProviders}
      session={session}
      title="Compete. Connect. Stay consistent."
    >
      <ChallengesView
        initialData={challenges}
        providers={authProviders}
        signedIn={Boolean(session?.user?.id)}
      />
    </AppShell>
  );
}
