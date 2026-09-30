import { auth, authProviders } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "FastTrack — Terms of Use",
  description: "Read the core terms for using FastTrack, including eligibility, account responsibilities, and product disclaimers.",
};

const sections = [
  {
    title: "Using FastTrack",
    body: "FastTrack is provided to help you track fasting windows, history, and accountability features. You are responsible for how you use the product and for choosing routines that are appropriate for you.",
  },
  {
    title: "Eligibility and safety",
    body: "You should only use FastTrack if fasting is appropriate for you. If you are under 18, pregnant, managing diabetes, recovering from illness, or have a history of disordered eating, seek qualified medical guidance before fasting.",
  },
  {
    title: "Accounts and conduct",
    body: "You are responsible for maintaining access to your account and for using social features respectfully. Do not impersonate others, scrape member data, or use FastTrack to harass or pressure other users.",
  },
  {
    title: "Availability",
    body: "FastTrack may change over time, including features, pricing, availability, or limits. We may suspend or remove features when needed to improve reliability, privacy, or safety.",
  },
  {
    title: "No medical advice",
    body: "FastTrack does not provide medical advice, diagnosis, or treatment. Any milestone names, streaks, or coaching notes are informational only and should not be treated as medical guidance.",
  },
  {
    title: "Contact and updates",
    body: "By continuing to use FastTrack, you agree to these terms and any future updates posted here. Review this page periodically for material changes.",
  },
] as const;

export default async function TermsPage() {
  const session = await auth();

  return (
    <AppShell
      currentPath="/terms"
      description="The core rules, responsibilities, and disclaimers for using FastTrack."
      providers={authProviders}
      session={session}
      title="Terms of Use"
    >
      <div className="grid gap-6">
        <p className="text-sm text-muted-foreground">Last updated: September 30, 2026</p>
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
            <p>For help with FastTrack, account access, or a request to delete your account data, contact <a className="text-primary-readable underline underline-offset-4" href="mailto:willardwells@gmail.com">willardwells@gmail.com</a>.</p>
            <p>Include the email used for your account and a short description of your request. Never send your password. Guest data stays in your browser and can be removed by clearing this site’s storage.</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
