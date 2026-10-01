import { Suspense } from "react";
import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { ProfileView } from "@/components/profile/profile-view";
import { PushNotificationControl } from "@/components/profile/push-notification-control";
import { Button } from "@/components/ui/button";
import { getProfilePageData, getPushNotificationStatus } from "@/lib/fasting-data";

export const metadata = {
  title: "FastTrack — Profile",
  description: "See your streak, level, badges, notifications, and recent FastTrack activity.",
};

async function NotificationControl({ status }: { status: Promise<boolean | null> }) {
  return <PushNotificationControl initialEnabled={await status} />;
}

export default async function ProfilePage() {
  const session = await auth();
  // Start together, but do not hold profile content behind optional push settings.
  const notificationStatus = getPushNotificationStatus(session?.user?.id);
  const profile = await getProfilePageData(session?.user?.id, { deferPushStatus: true });

  return (
    <AppShell
      currentPath="/profile"
      description="See your streak, level, badges, and saved progress in one calm account view."
      providers={authProviders}
      session={session}
      profile={profile.profile}
      title="Your progress, all in one place."
    >
      <ProfileView
        initialData={profile}
        providers={authProviders}
        signedIn={Boolean(session?.user?.id)}
        notificationControl={
          <Suspense fallback={<Button disabled variant="outline" className="rounded-2xl">Loading notification settings…</Button>}>
            <NotificationControl status={notificationStatus} />
          </Suspense>
        }
      />
    </AppShell>
  );
}
