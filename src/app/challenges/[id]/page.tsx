import { notFound } from "next/navigation";
import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { ChallengeDetailView } from "@/components/challenges/challenge-detail-view";
import { getChallengeDetail } from "@/lib/fasting-data";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = (await auth())?.user?.id;
  const challenge = await getChallengeDetail(id, userId);

  if (!challenge) {
    return { title: "FastTrack — Challenge Not Found" };
  }

  return {
    title: `FastTrack — ${challenge.title}`,
    description: challenge.description ?? "View challenge leaderboard and progress.",
  };
}

export default async function ChallengeDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const challenge = await getChallengeDetail(id, session?.user?.id);

  if (!challenge) {
    notFound();
  }

  return (
    <AppShell
      currentPath={`/challenges/${id}`}
      description="Track progress against participants and see who's leading."
      providers={authProviders}
      session={session}
      title={challenge.title}
    >
      <ChallengeDetailView
        challenge={challenge}
        signedIn={Boolean(session?.user?.id)}
      />
    </AppShell>
  );
}