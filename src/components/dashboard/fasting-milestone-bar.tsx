import { format } from "date-fns";

import { formatCompactDuration, formatStageHour } from "@/lib/fasting";
import {
  FASTING_STAGES,
  getCurrentStage,
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
  const plannedHours = plannedMinutes / 60;
  const currentMilestone = getCurrentStage(elapsedHours);
  const nextMilestone = FASTING_STAGES.find((stage) => stage.hour > elapsedHours) ?? null;
  const visibleMilestones = FASTING_STAGES.filter((stage) => stage.hour <= plannedHours);
  const progressPercent = Math.max(0, Math.min(100, (elapsedMinutes / plannedMinutes) * 100));
  const markerPercent = Math.max(1, Math.min(99, progressPercent));
  const endTime = new Date(Date.parse(startedAt) + plannedMinutes * 60000).toISOString();
  const cautionCopy =
    elapsedMinutes >= 18 * 60
      ? "This is FastTrack's cautious planning max. Stay within your plan and stop if you feel unwell."
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
          <div className="pointer-events-none absolute inset-x-0 top-1/2 hidden -translate-y-1/2 sm:block">
            {visibleMilestones.map((milestone) => (
              <span
                key={milestone.hour}
                className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.22]"
                style={{
                  left: `${Math.max(1, Math.min(99, (milestone.hour / plannedHours) * 100))}%`,
                }}
                title={`${formatStageHour(milestone.hour)} · ${milestone.label}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm leading-6">
        <p className="text-muted-foreground">
          Elapsed:{" "}
          <span className="font-medium text-foreground">
            {formatCompactDuration(elapsedMinutes)}
          </span>
        </p>
        <p className="text-muted-foreground">
          Current stage:{" "}
          <span className="font-medium text-foreground">
            {currentMilestone.label} · begins at {formatStageHour(currentMilestone.hour)}
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
