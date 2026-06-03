"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Flame, Globe2, Lock, Plus, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Challenge, ChallengesListData, ChallengeType, CHALLENGE_TYPE_LABELS, CHALLENGE_TYPE_ICONS } from "@/lib/fasting";
import { cn } from "@/lib/utils";

type ChallengesViewProps = {
  initialData: ChallengesListData;
  providers: {
    google: boolean;
    github: boolean;
  };
  signedIn: boolean;
};

const createSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters.").max(80),
  description: z.string().max(300).optional(),
  challengeType: z.enum(["streak_days", "total_hours", "daily_fast", "milestone_reach"]),
  targetValue: z.coerce.number().int().min(1, "Target must be at least 1."),
  durationDays: z.coerce.number().int().min(1).max(90),
  visibility: z.enum(["circle", "public"]),
});

type ChallengeVisibility = z.infer<typeof createSchema>["visibility"];

const TYPE_HELP: Record<ChallengeType, string> = {
  streak_days: "Maintain a consecutive-day fasting streak",
  total_hours: "Accumulate total fasting hours",
  daily_fast: "Complete a fast on X different days",
  milestone_reach: "Reach autophagy or beyond X times",
};

const TYPE_UNITS: Record<ChallengeType, string> = {
  streak_days: "days",
  total_hours: "hours",
  daily_fast: "days",
  milestone_reach: "times",
};

const DURATION_OPTIONS = [
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "21", label: "21 days" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
];

const CHALLENGE_TEMPLATES = [
  {
    title: "7-Day Consistency Sprint",
    challengeType: "daily_fast" as const,
    targetValue: "7",
    durationDays: "7",
    description: "Complete one fast per day for a week.",
  },
  {
    title: "20-Hour Club",
    challengeType: "total_hours" as const,
    targetValue: "20",
    durationDays: "7",
    description: "Stack up 20 fasting hours this week.",
  },
  {
    title: "Autophagy Hunt",
    challengeType: "milestone_reach" as const,
    targetValue: "3",
    durationDays: "14",
    description: "Reach the autophagy milestone three times.",
  },
] satisfies Array<{
  title: string;
  challengeType: ChallengeType;
  targetValue: string;
  durationDays: string;
  description: string;
}>;

const TYPE_ACCENTS: Record<ChallengeType, string> = {
  streak_days: "from-rose-500/30 via-orange-400/10 to-transparent",
  total_hours: "from-sky-400/30 via-cyan-300/10 to-transparent",
  daily_fast: "from-emerald-400/30 via-lime-300/10 to-transparent",
  milestone_reach: "from-violet-400/30 via-fuchsia-300/10 to-transparent",
};

function getInitials(value?: string | null) {
  if (!value) return "FT";
  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getDaysLabel(endsAtValue: string) {
  const diff = Math.ceil((Date.parse(endsAtValue) - Date.now()) / 86400000);

  if (diff <= 0) return "Ended";
  if (diff === 1) return "1 day left";
  return `${diff} days left`;
}

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const participantCopy = `${challenge.participantCount} ${
    challenge.participantCount === 1 ? "participant" : "participants"
  }`;

  return (
    <Link href={`/challenges/${challenge.id}`} aria-label={`Open ${challenge.title}`} className="block">
      <div className="group relative overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-[rgba(255,255,255,0.045)] px-4 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.07] hover:shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", TYPE_ACCENTS[challenge.challengeType])} />
        <div className="pointer-events-none absolute -right-10 -top-12 size-28 rounded-full bg-primary/10 blur-2xl transition-opacity group-hover:opacity-80" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-2xl bg-white/[0.08] text-base">
                {CHALLENGE_TYPE_ICONS[challenge.challengeType]}
              </span>
              <h3 className="truncate text-sm font-semibold text-foreground">{challenge.title}</h3>
            </div>
            {challenge.description && (
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{challenge.description}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant="outline" className="border-primary/30 text-primary">
              {CHALLENGE_TYPE_LABELS[challenge.challengeType]}
            </Badge>
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {challenge.isPublic ? "Public" : "Circle"}
            </span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="premium-chip rounded-2xl px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">People</p>
            <p className="mt-1 truncate font-semibold text-foreground">{participantCopy}</p>
          </div>
          <div className="premium-chip rounded-2xl px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Time</p>
            <p className="mt-1 truncate font-semibold text-foreground">{getDaysLabel(challenge.endsAt)}</p>
          </div>
          <div className="premium-chip rounded-2xl px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Target</p>
            <p className="mt-1 truncate font-semibold text-foreground">
              {challenge.targetValue} {TYPE_UNITS[challenge.challengeType]}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar size="sm">
              <AvatarImage src={challenge.creator.avatarUrl ?? undefined} alt={challenge.creator.displayName ?? "Creator"} />
              <AvatarFallback>{getInitials(challenge.creator.displayName)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-[10px] text-muted-foreground/70">
              by {challenge.creator.displayName ?? "FastTrack user"}
            </span>
          </div>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
      </div>
    </Link>
  );
}

type ChallengeTemplate = (typeof CHALLENGE_TEMPLATES)[number];

function CreateChallengeDialog({
  buttonLabel = "Create",
  onCreated,
  template,
}: {
  buttonLabel?: string;
  onCreated: () => void;
  template?: ChallengeTemplate;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(template?.title ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [challengeType, setChallengeType] = useState<ChallengeType>(template?.challengeType ?? "streak_days");
  const [targetValue, setTargetValue] = useState(template?.targetValue ?? "");
  const [durationDays, setDurationDays] = useState(template?.durationDays ?? "7");
  const [visibility, setVisibility] = useState<ChallengeVisibility>("circle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    setErrors({});

    const parsed = createSchema.safeParse({
      title,
      description: description || undefined,
      challengeType,
      targetValue: targetValue || "0",
      durationDays,
      visibility,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path[0] as string] = issue.message;
        break;
      }
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to create challenge.");
      }

      const { challengeId } = await response.json();

      toast.success("Challenge launched!");
      setOpen(false);
      setTitle("");
      setDescription("");
      setTargetValue("");
      setChallengeType("streak_days");
      setDurationDays("7");
      setVisibility("circle");
      onCreated();
      router.push(`/challenges/${challengeId}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isSubmitting && setOpen(nextOpen)}>
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {buttonLabel}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Challenge</DialogTitle>
          <DialogDescription>
            Set a goal, pick a duration, and choose who sees it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <label className="text-xs font-medium text-foreground">Visibility</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  value: "circle" as const,
                  label: "Circle",
                  icon: Lock,
                  copy: "Accepted friends join automatically.",
                },
                {
                  value: "public" as const,
                  label: "Public",
                  icon: Globe2,
                  copy: "Available for others to join.",
                },
              ].map((option) => {
                const Icon = option.icon;
                const active = visibility === option.value;

                return (
                  <button
                    key={option.value}
                    className={cn(
                      "rounded-2xl border px-3 py-3 text-left transition-colors",
                      active
                        ? "border-primary/50 bg-primary/15 text-foreground"
                        : "border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:bg-white/[0.07]"
                    )}
                    onClick={() => setVisibility(option.value)}
                    type="button"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Icon className="size-4" />
                      {option.label}
                    </span>
                    <span className="mt-1 block text-[11px] leading-4">{option.copy}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-medium text-foreground">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 7-Day Streak Challenge"
              maxLength={80}
            />
            {errors.title && <p className="text-xs text-red-400">{errors.title}</p>}
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-medium text-foreground">Type</label>
            <Select
              value={challengeType}
              onValueChange={(value) => {
                if (!value) {
                  return;
                }

                setChallengeType(value as ChallengeType);
                setTargetValue("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CHALLENGE_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {CHALLENGE_TYPE_ICONS[key as ChallengeType]} {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">{TYPE_HELP[challengeType]}</p>
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-medium text-foreground">Target ({TYPE_UNITS[challengeType]})</label>
            <Input
              type="number"
              min={1}
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder={challengeType === "total_hours" ? "e.g. 20" : "e.g. 7"}
            />
            {errors.targetValue && <p className="text-xs text-red-400">{errors.targetValue}</p>}
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-medium text-foreground">Duration</label>
            <Select
              value={durationDays}
              onValueChange={(value) => {
                if (!value) {
                  return;
                }

                setDurationDays(value);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-medium text-foreground">Description (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this challenge about?"
              maxLength={300}
              rows={2}
            />
          </div>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Creating..." : "Launch Challenge"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ChallengesView({ initialData, providers, signedIn }: ChallengesViewProps) {
  const [data, setData] = useState(initialData);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function refresh() {
      const response = await fetch("/api/challenges", { cache: "no-store" });
      if (response.ok) {
        const next = await response.json();
        setData(next);
      }
    }
    refresh();
  }, [refreshKey]);

  if (!signedIn) {
    return (
      <Card className="section-enter" style={{ animationDelay: "0ms" }}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-2 text-primary shadow-[0_8px_20px_rgba(139,92,246,0.16)]">
              <Trophy className="size-4" />
            </div>
            <div>
              <CardTitle>Challenges</CardTitle>
              <CardDescription>
                Join time-bound fasting challenges and compete with your circle.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <EmptyState
            eyebrow="Signed out"
            title="Compete and stay motivated."
            description="FastTrack challenges let you set goals, track progress against friends, and earn badges. Sign in to get started."
            actions={
              <SignInDialog
                buttonClassName="w-full sm:w-auto"
                buttonLabel="Sign in to join challenges"
                providers={providers}
                size="lg"
              />
            }
            preview={
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Daily Sprint", "7 days", "Consistency"],
                  ["20-Hour Club", "20h", "Team goal"],
                  ["Milestone Hunt", "3x", "Autophagy"],
                ].map(([title, value, label]) => (
                  <div key={title} className="premium-chip rounded-[1.25rem] p-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{title}</p>
                  </div>
                ))}
              </div>
            }
          />
        </CardContent>
      </Card>
    );
  }

  const hasContent = data.active.length > 0 || data.joinable.length > 0 || data.past.length > 0;

  return (
    <div className="grid gap-6">
      <Card className="section-enter" style={{ animationDelay: "0ms" }}>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-2 text-primary shadow-[0_8px_20px_rgba(139,92,246,0.16)]">
                <Trophy className="size-4" />
              </div>
              <div>
                <CardTitle>Challenges</CardTitle>
                <CardDescription>
                  Time-bound goals with friends. Consistency wins.
                </CardDescription>
              </div>
            </div>
            <CreateChallengeDialog onCreated={() => setRefreshKey((k) => k + 1)} />
          </div>
        </CardHeader>
        <CardContent>
          {!hasContent ? (
            <div className="grid gap-5">
              <EmptyState
                eyebrow="Fresh board"
                title="Start the first challenge."
                description="Pick a quick-start format or launch a custom goal for your circle."
                actions={
                  <CreateChallengeDialog onCreated={() => setRefreshKey((k) => k + 1)} />
                }
              />
              <div className="grid gap-3 sm:grid-cols-3">
                {CHALLENGE_TEMPLATES.map((template) => (
                  <div key={template.title} className="glass-soft rounded-[1.5rem] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Sparkles className="size-4 text-primary" />
                      <p className="truncate text-sm font-semibold text-foreground">{template.title}</p>
                    </div>
                    <p className="mb-4 min-h-10 text-xs leading-5 text-muted-foreground">{template.description}</p>
                    <CreateChallengeDialog
                      buttonLabel="Use template"
                      onCreated={() => setRefreshKey((k) => k + 1)}
                      template={template}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Tabs defaultValue="active" className="gap-5">
              <TabsList>
                <TabsTrigger value="active">
                  Active {data.active.length > 0 && `(${data.active.length})`}
                </TabsTrigger>
                <TabsTrigger value="joinable">
                  Browse {data.joinable.length > 0 && `(${data.joinable.length})`}
                </TabsTrigger>
                <TabsTrigger value="past">Past</TabsTrigger>
              </TabsList>
              <TabsContent value="active">
                {data.active.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/60 px-5 py-12 text-center">
                    <Flame className="mx-auto mb-3 size-5 text-primary" />
                    <p className="text-sm font-medium text-foreground">No active challenges yet.</p>
                    <p className="mt-1 text-sm text-muted-foreground">Browse open challenges or launch one your way.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.active.map((c) => (
                      <ChallengeCard key={c.id} challenge={c} />
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="joinable">
                {data.joinable.length === 0 ? (
                  <p className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/60 px-5 py-14 text-center text-sm text-muted-foreground">
                    No open challenges to join right now. Create one!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.joinable.map((c) => (
                      <ChallengeCard key={c.id} challenge={c} />
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="past">
                {data.past.length === 0 ? (
                  <p className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/60 px-5 py-14 text-center text-sm text-muted-foreground">
                    No past challenges.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.past.map((c) => (
                      <ChallengeCard key={c.id} challenge={c} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
