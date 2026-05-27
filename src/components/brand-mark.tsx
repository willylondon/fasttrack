import { Bolt } from "lucide-react";

export function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary to-accent shadow-[0_0_30px_rgba(139,92,246,0.3)]">
        <Bolt className="size-5 text-primary-foreground" />
      </div>
      <div>
        <p className="font-[family:var(--font-heading)] text-lg font-semibold tracking-tight">
          FastTrack
        </p>
        <p className="text-xs text-muted-foreground">Social fasting, one streak at a time.</p>
      </div>
    </div>
  );
}
