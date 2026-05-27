import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { FriendsView } from "@/components/friends/friends-view";
import { getFriendsPageData } from "@/lib/fasting-data";

export default async function FriendsPage() {
  const session = await auth();
  const friends = await getFriendsPageData(session?.user?.id);

  return (
    <AppShell
      currentPath="/friends"
      description="Search FastTrack members, handle pending requests, and keep your streak circle close."
      providers={authProviders}
      session={session}
      title="Friends"
    >
      <FriendsView initialData={friends} />
    </AppShell>
  );
}
