import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { FriendsView } from "@/components/friends/friends-view";
import { getFriendsPageData } from "@/lib/fasting-data";

export const metadata = {
  title: "FastTrack — Friends",
  description: "Find friends, manage requests, and build a steady accountability circle in FastTrack.",
};

export default async function FriendsPage() {
  const session = await auth();
  const friends = await getFriendsPageData(session?.user?.id);

  return (
    <AppShell
      currentPath="/friends"
      description="Search by name or email, manage requests, and keep your accountability circle close."
      providers={authProviders}
      session={session}
      title="Build your fasting circle."
    >
      <FriendsView initialData={friends} providers={authProviders} signedIn={Boolean(session?.user?.id)} />
    </AppShell>
  );
}
