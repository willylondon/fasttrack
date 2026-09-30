import { format } from "date-fns";

import { getWeekActivity } from "@/components/dashboard/week-activity-data";
import type { FastSession } from "@/lib/fasting";
import { cn } from "@/lib/utils";

type WeekActivityProps = {
  sessions: FastSession[];
  now: number;
  ready: boolean;
};

export function WeekActivity({ sessions, now, ready }: WeekActivityProps) {
  const days = ready ? getWeekActivity(sessions, now) : [];

  return (
    <section aria-label="Recent completions in the last seven days" className="border-b border-white/[0.08] pb-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <p>Last 7 days</p>
        <p>Completed fasts · recent history</p>
      </div>
      {ready ? (
        <ol className="grid grid-cols-7 gap-1">
          {days.map((day) => (
            <li
              key={day.key}
              aria-current={day.isToday ? "date" : undefined}
              aria-label={`${format(day.date, "EEEE, MMMM d")}${day.isToday ? ", today" : ""}: ${day.completedCount ? `${day.completedCount} completed fast${day.completedCount === 1 ? "" : "s"} in recent history` : "no completion in recent history"}`}
              className="flex flex-col items-center gap-1"
            >
              <span aria-hidden="true" className={cn("text-[10px] font-medium uppercase tracking-wide", day.isToday ? "text-foreground" : "text-muted-foreground")}>
                {day.isToday ? "Today" : format(day.date, "EEE")}
              </span>
              <span aria-hidden="true" className={cn(
                "timer-numerals grid size-7 place-items-center rounded-full border text-xs font-semibold",
                day.completedCount ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200" : "border-white/10 text-muted-foreground",
                day.isToday && "ring-2 ring-primary/60 ring-offset-2 ring-offset-[#17151d]"
              )}>
                {day.completedCount || "–"}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <div aria-label="Loading recent completions" className="h-[46px]" />
      )}
    </section>
  );
}
