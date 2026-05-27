import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { ProfileView } from "@/components/profile/profile-view";
import { getProfilePageData } from "@/lib/fasting-data";

export default async function ProfilePage() {
  const session = await auth();
  const profile = await getProfilePageData(session?.user?.id);

  return (
    <AppShell
      currentPath="/profile"
      description="Track your level, XP progress, badge cabinet, and recent FastTrack activity."
      providers={authProviders}
      session={session}
      title="Profile"
    >
      <ProfileView initialData={profile} />
    </AppShell>
  );
}
