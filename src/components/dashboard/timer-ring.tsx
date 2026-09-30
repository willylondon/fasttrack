import { formatCompactDuration } from "@/lib/fasting";
import type { FastingStage } from "@/lib/fasting-stages";

type TimerRingProps = {
  elapsedMinutes: number;
  elapsedSeconds?: number;
  plannedMinutes: number;
  progress: number;
  stage: FastingStage;
  active: boolean;
};

export function TimerRing({ elapsedMinutes, elapsedSeconds, plannedMinutes, progress, stage, active }: TimerRingProps) {
  const seconds = active ? Math.max(0, Math.floor(elapsedSeconds ?? elapsedMinutes * 60)) : 0;
  const safeProgress = Math.max(0, Math.min(100, elapsedSeconds === undefined ? progress : (seconds / (plannedMinutes * 60)) * 100));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const durationLabel = [hours, minutes, seconds % 60].map((value) => String(value).padStart(2, "0")).join(":");
  const planReached = active && seconds >= plannedMinutes * 60;
  const remainingMinutes = Math.max(0, Math.ceil((plannedMinutes * 60 - seconds) / 60));

  return (
    <div className="relative mx-auto grid aspect-square w-[min(66vw,16rem)] place-items-center sm:w-72">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-4 rounded-full opacity-70 blur-xl"
        style={{ background: `${stage.color}18` }}
      />
      <div
        aria-label={`Fasting timer: ${durationLabel} elapsed, ${formatCompactDuration(plannedMinutes)} plan`}
        role="timer"
        aria-live="off"
        className="relative flex size-full items-center justify-center rounded-full p-2.5 shadow-[0_0_22px_rgba(0,0,0,0.22)] sm:p-3"
        style={{ background: `conic-gradient(${stage.color} ${safeProgress}%, rgba(255,255,255,0.08) 0)` }}
      >
        <div className="flex size-full flex-col items-center justify-center rounded-full border border-white/[0.08] bg-[#101115] px-3 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {active ? "Time elapsed" : "Ready when you are"}
          </p>
          <p aria-hidden="true" className="timer-numerals mt-2 font-[family:var(--font-heading)] text-[clamp(2rem,10vw,3.25rem)] font-semibold leading-none tracking-[-0.04em] text-foreground sm:text-[3.5rem]">
            {durationLabel}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {planReached ? "Planned window reached" : active ? `${formatCompactDuration(remainingMinutes)} remaining` : `${formatCompactDuration(plannedMinutes)} planned window`}
          </p>
        </div>
      </div>
    </div>
  );
}
