import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "FastTrack — Privacy Policy",
  description: "Learn what FastTrack stores locally, what is saved to your account, and how social sharing works.",
};

const sections = [
  {
    title: "What FastTrack stores",
    body: "FastTrack stores your current fast, recent sessions, and milestone progress locally on your device when you use guest mode. When you sign in, your profile, history, challenges, and social settings are saved to your account.",
  },
  {
    title: "Guest mode and local data",
    body: "If you use FastTrack without signing in, your progress stays on the current device and browser. Signing in lets you sync that data to your account so it is available across devices.",
  },
  {
    title: "Social visibility",
    body: "Live fasting status is hidden by default. You can turn live sharing on from your profile at any time. Friend requests, challenge participation, and encouragement features are only available to signed-in members.",
  },
  {
    title: "Notifications",
    body: "Push notifications are optional. If you enable them, FastTrack stores the subscription details needed to send reminders and activity alerts. You can turn notifications off from your profile.",
  },
  {
    title: "Third-party services",
    body: "FastTrack uses authentication and data infrastructure providers to support sign-in, storage, and app delivery. Only the data needed to run the product is shared with those providers.",
  },
  {
    title: "Health disclaimer",
    body: "FastTrack is a tracking tool, not a medical service. It does not provide diagnosis, treatment, or medical advice, and it should not be used as a substitute for qualified guidance.",
  },
] as const;

export default async function PrivacyPage() {
  const session = await auth();

  return (
    <AppShell
      currentPath="/privacy"
      description="A plain-language summary of what FastTrack stores and how sharing works."
      providers={authProviders}
      session={session}
      title="Privacy Policy"
    >
      <div className="grid gap-6">
        {sections.map((section) => (
          <Card key={section.title} className="section-enter">
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground sm:text-base">{section.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
