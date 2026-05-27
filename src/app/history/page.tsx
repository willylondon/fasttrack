import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { HistoryView } from "@/components/history/history-view";
import { getHistoryData } from "@/lib/fasting-data";

export default async function HistoryPage() {
  const session = await auth();
  const history = await getHistoryData(session?.user?.id);

  return (
    <AppShell
      currentPath="/history"
      description="Stats, completion trends, and a clean list of completed fasts."
      providers={authProviders}
      session={session}
      title="History"
    >
      <HistoryView initialData={history} />
    </AppShell>
  );
}
