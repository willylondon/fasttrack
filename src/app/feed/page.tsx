import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { FeedView } from "@/components/feed/feed-view";
import { getFeedPageData } from "@/lib/fasting-data";

export default async function FeedPage() {
  const session = await auth();
  const feed = await getFeedPageData(session?.user?.id);

  return (
    <AppShell
      currentPath="/feed"
      description="Friend milestones, completed fasts, and shared momentum grouped into a clean social feed."
      providers={authProviders}
      session={session}
      title="Feed"
    >
      <FeedView initialData={feed} />
    </AppShell>
  );
}
