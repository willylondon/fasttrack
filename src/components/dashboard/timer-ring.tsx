import { formatDuration } from "@/lib/fasting";
import { FastingStage } from "@/lib/fasting-stages";

type TimerRingProps = {
  elapsedMinutes: number;
  plannedMinutes: number;
  progress: number;
  stage: FastingStage;
  active: boolean;
};

export function TimerRing({ elapsedMinutes, plannedMinutes, progress, stage, active }: TimerRingProps) {
  const safeProgress = Math.max(0, Math.min(100, progress));
  const durationLabel = active ? formatDuration(elapsedMinutes) : formatDuration(0);
  const targetHours = Math.round(plannedMinutes / 60);

  return (
    <div className="relative grid min-h-[240px] w-full place-items-center sm:min-h-[320px]">
      <div className="relative grid place-items-center">
        <div
          className="pointer-events-none absolute inset-0 rounded-full opacity-90 blur-xl transition-all duration-500 sm:blur-2xl"
          style={{
            background: `radial-gradient(circle, ${stage.color}26 0%, rgba(0, 0, 0, 0) 70%)`,
            width: "min(18rem, 72vw)",
            height: "min(18rem, 72vw)",
          }}
        />
        <div
          aria-label={`Timer ring showing ${durationLabel} elapsed`}
          className="relative flex size-56 items-center justify-center rounded-full p-3 shadow-[0_0_22px_rgba(0,0,0,0.22)] sm:size-72 sm:p-4 sm:shadow-[0_0_38px_rgba(0,0,0,0.26)]"
          style={{
            background: `conic-gradient(${stage.color} ${safeProgress}%, rgba(255,255,255,0.08) 0)`,
          }}
        >
          <div className="flex size-full flex-col items-center justify-center rounded-full border border-white/[0.08] bg-[rgba(14,15,20,0.96)] text-center shadow-[0_10px_28px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.04)] sm:shadow-[0_16px_40px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.04)]">
            <p className="text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground sm:text-[0.68rem]">Planned {targetHours}h</p>
            <p className="mt-2 font-[family:var(--font-heading)] text-4xl font-bold tracking-tight text-foreground sm:mt-3 sm:text-5xl">
              {durationLabel}
            </p>
            <div className="mt-2 flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.05] px-2.5 py-1 text-xs text-muted-foreground sm:mt-3 sm:px-3 sm:py-1.5 sm:text-sm">
              <span className="text-sm sm:text-base">{stage.emoji}</span>
              <span>{active ? stage.label : "Ready when you are"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
