import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { ProfileView } from "@/components/profile/profile-view";
import { getProfilePageData } from "@/lib/fasting-data";

export const metadata = {
  title: "FastTrack — Profile",
  description: "See your streak, level, badges, notifications, and recent FastTrack activity.",
};

export default async function ProfilePage() {
  const session = await auth();
  const profile = await getProfilePageData(session?.user?.id);

  return (
    <AppShell
      currentPath="/profile"
      description="See your streak, level, badges, and saved progress in one calm account view."
      providers={authProviders}
      session={session}
      title="Your progress, all in one place."
    >
      <ProfileView initialData={profile} providers={authProviders} signedIn={Boolean(session?.user?.id)} />
    </AppShell>
  );
}
