import { Bolt } from "lucide-react";

export function BrandMark() {
  return (
    <div className="flex items-center gap-3.5">
      <div className="flex size-12 items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-primary via-primary to-accent shadow-[0_0_36px_rgba(139,92,246,0.34)]">
        <Bolt className="size-[1.35rem] text-primary-foreground" />
      </div>
      <div>
        <p className="font-[family:var(--font-heading)] text-xl font-bold tracking-tight">
          FastTrack
        </p>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Social fasting, one streak at a time.</p>
      </div>
    </div>
  );
}
