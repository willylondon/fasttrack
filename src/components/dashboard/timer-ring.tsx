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
  const radius = 104;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeProgress / 100) * circumference;
  const durationLabel = active ? formatDuration(elapsedMinutes) : formatDuration(0);
  const targetHours = Math.round(plannedMinutes / 60);

  return (
    <div className="relative flex items-center justify-center">
      <div
        className="absolute inset-12 rounded-full blur-2xl transition-all duration-500"
        style={{ backgroundColor: `${stage.color}28` }}
      />
      <svg viewBox="0 0 260 260" className="size-56 sm:size-72 drop-shadow-[0_0_38px_rgba(0,0,0,0.26)]">
        <circle cx="130" cy="130" r={radius} className="fill-transparent stroke-white/[0.06]" strokeWidth="16" />
        <circle
          cx="130"
          cy="130"
          r={radius}
          className="fill-transparent transition-all duration-700 ease-out"
          stroke={stage.color}
          strokeWidth="16"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 130 130)"
        />
      </svg>
      <div className="glass-card absolute flex size-40 sm:size-52 flex-col items-center justify-center rounded-full text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <p className="text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground sm:text-[0.68rem]">Planned {targetHours}h</p>
        <p className="mt-2 sm:mt-3 font-[family:var(--font-heading)] text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          {durationLabel}
        </p>
        <div className="mt-2 sm:mt-3 flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.05] px-2.5 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm text-muted-foreground">
          <span className="text-sm sm:text-base">{stage.emoji}</span>
          <span>{active ? stage.label : "Ready when you are"}</span>
        </div>
      </div>
    </div>
  );
}
