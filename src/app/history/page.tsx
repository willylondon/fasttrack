import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { HistoryView } from "@/components/history/history-view";
import { getHistoryData } from "@/lib/fasting-data";

export const metadata = {
  title: "FastTrack — History",
  description: "Review your completed windows, trends, streaks, and recent sessions in FastTrack.",
};

export default async function HistoryPage() {
  const session = await auth();
  const history = await getHistoryData(session?.user?.id);

  return (
    <AppShell
      currentPath="/history"
      description="Review your consistency, see how your windows are trending, and revisit recent sessions."
      providers={authProviders}
      session={session}
      title="Your history, clearly laid out."
    >
      <HistoryView initialData={history} providers={authProviders} signedIn={Boolean(session?.user?.id)} />
    </AppShell>
  );
}
