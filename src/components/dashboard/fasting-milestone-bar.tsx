import { format } from "date-fns";

import { formatStageHour } from "@/lib/fasting";
import {
  FASTING_MILESTONES,
  getCurrentMilestone,
  getNextMilestone,
} from "@/lib/fasting-stages";

type FastingMilestoneBarProps = {
  active: boolean;
  elapsedMinutes: number;
  plannedMinutes: number;
  startedAt: string | null;
};

function formatTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return format(new Date(value), "p");
}

export function FastingMilestoneBar({
  active,
  elapsedMinutes,
  plannedMinutes,
  startedAt,
}: FastingMilestoneBarProps) {
  if (!active || !startedAt) {
    return (
      <div className="glass-soft rounded-[1.7rem] p-4 sm:p-5">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
          Estimated milestone progress
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Milestones will appear after you start a fast.
        </p>
      </div>
    );
  }

  const elapsedHours = elapsedMinutes / 60;
  const currentMilestone = getCurrentMilestone(elapsedHours);
  const nextMilestone = getNextMilestone(elapsedHours);
  const progressPercent = Math.max(0, Math.min(100, (elapsedMinutes / plannedMinutes) * 100));
  const markerPercent = Math.max(1, Math.min(99, progressPercent));
  const endTime = new Date(Date.parse(startedAt) + plannedMinutes * 60000).toISOString();
  const cautionCopy =
    elapsedMinutes >= 24 * 60
      ? "This is an extended window. Medical guidance matters if longer fasting is part of your routine."
      : elapsedMinutes >= 18 * 60
        ? "This is an advanced window. Stay within your plan and stop if you feel unwell."
        : elapsedMinutes > plannedMinutes
          ? "Your planned window has passed. Stay within your plan and end when it feels appropriate."
          : null;

  return (
    <div className="glass-soft rounded-[1.7rem] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
          Estimated milestone progress
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <p className="min-w-0 truncate">
          Started <span className="font-medium text-foreground">{formatTime(startedAt)}</span>
        </p>
        <p className="min-w-0 truncate text-right">
          Ends <span className="font-medium text-foreground">{formatTime(endTime)}</span>
        </p>
      </div>

      <div className="mt-4">
        <div className="relative h-3 rounded-full bg-white/[0.06]">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{
              width: `${progressPercent}%`,
              background: `linear-gradient(90deg, ${currentMilestone.color}99, ${currentMilestone.color})`,
            }}
          />
          <div
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow-[0_0_0_6px_rgba(255,255,255,0.05)] transition-all duration-500"
            style={{
              left: `${markerPercent}%`,
              backgroundColor: currentMilestone.color,
            }}
          />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 hidden -translate-y-1/2 px-1 sm:flex sm:items-center sm:justify-between">
            {FASTING_MILESTONES.map((milestone) => (
              <span
                key={milestone.hour}
                className="size-1.5 rounded-full bg-white/[0.18]"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm leading-6">
        <p className="text-muted-foreground">
          Current:{" "}
          <span className="font-medium text-foreground">
            {formatStageHour(currentMilestone.hour)} in · {currentMilestone.label}
          </span>
        </p>
        <p className="text-muted-foreground">
          Next:{" "}
          <span className="font-medium text-foreground">
            {nextMilestone
              ? `${formatStageHour(nextMilestone.hour)} · ${nextMilestone.label}`
              : "Stay within your plan and end when it feels appropriate."}
          </span>
        </p>
      </div>

      {cautionCopy ? (
        <p className="mt-3 text-sm leading-6 text-amber-100">
          {cautionCopy}
        </p>
      ) : null}
    </div>
  );
}
