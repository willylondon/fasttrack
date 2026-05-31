import { Bolt } from "lucide-react";

export function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-11 items-center justify-center rounded-[1.2rem] bg-gradient-to-br from-primary via-primary to-accent shadow-[0_0_32px_rgba(139,92,246,0.28)] sm:size-12 sm:rounded-[1.35rem]">
        <Bolt className="size-5 text-primary-foreground sm:size-[1.35rem]" />
      </div>
      <div>
        <p className="font-[family:var(--font-heading)] text-lg font-bold tracking-tight sm:text-xl">
          FastTrack
        </p>
        <p className="hidden text-xs uppercase tracking-[0.18em] text-muted-foreground sm:block">
          Track your window. Stay consistent.
        </p>
      </div>
    </div>
  );
}
