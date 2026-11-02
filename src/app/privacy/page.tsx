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
    body: "Live sharing is on by default for accepted friends, who can see when you are fasting, for how long, and your planned end time. You can turn it off in Profile; when it is off, they cannot see your active timer, start events, or in-progress checkpoints. Connecting with a friend shares completed progress, streaks and completed activity; your private notes and check-ins are not part of that sharing. Your display name, avatar and progress are visible to other participants in challenges you join. Friend requests, challenge participation, and encouragement features require sign-in.",
  },
  {
    title: "Notifications",
    body: "Push notifications are optional. If you enable them, FastTrack stores the subscription details needed to send reminders and activity alerts. You can turn notifications off from your profile.",
  },
  {
    title: "Third-party services",
    body: "FastTrack uses Google or GitHub for sign-in, which provide your name, email address and profile image; Supabase for data and avatar storage; and Vercel for hosting and app delivery. Only the data needed to run the product is shared with those providers. FastTrack does not sell your data or show advertising.",
  },
  {
    title: "Reports and blocking",
    body: "If you report a member, we store your report, the member reported, and a copy of the reported content so it can be reviewed. If you block a member, we store that block and delete encouragements between you.",
  },
  {
    title: "Retention and deletion",
    body: "We keep your account data until you delete your account. You can delete it at any time from Profile or by following the steps on the Delete Account page. Deletion immediately removes your account, profile, avatar, fasting history, check-ins, friends, messages, notifications, reports and challenges you created. Copies may remain in our providers' backups until those backups expire.",
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
        <p className="text-sm text-muted-foreground">Last updated: November 2, 2026</p>
        {sections.map((section) => (
          <Card key={section.title} className="section-enter">
            <CardHeader>
              <CardTitle><h2>{section.title}</h2></CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground sm:text-base">{section.body}</p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader><CardTitle><h2>Support and data requests</h2></CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground sm:text-base">
            <p>For help with FastTrack, account access, or if you can&apos;t sign in to delete your account, contact <a className="text-primary-readable underline underline-offset-4" href="mailto:willardwells@gmail.com">willardwells@gmail.com</a>.</p>
            <p>Include the email used for your account and a short description of your request. Never send your password. Guest data stays in your browser and can be removed by clearing this site’s storage.</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
