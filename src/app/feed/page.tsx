import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { FeedView } from "@/components/feed/feed-view";
import { getFeedPageData } from "@/lib/fasting-data";

export const metadata = {
  title: "FastTrack — Feed",
  description: "Keep up with friend activity, milestones, and completed windows inside FastTrack.",
};

export default async function FeedPage() {
  const session = await auth();
  const feed = await getFeedPageData(session?.user?.id);

  return (
    <AppShell
      currentPath="/feed"
      description="Follow friend activity, shared milestones, and the steady momentum that keeps accountability useful."
      providers={authProviders}
      session={session}
      title="See how your circle is doing."
    >
      <FeedView initialData={feed} providers={authProviders} signedIn={Boolean(session?.user?.id)} />
    </AppShell>
  );
}
