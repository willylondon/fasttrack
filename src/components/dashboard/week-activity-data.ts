import type { FastSession } from "@/lib/fasting";

export type ActivityDay = {
  date: Date;
  key: string;
  completedCount: number;
  isToday: boolean;
};

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** Recent records only: absence must never be presented as a missed day. */
export function getWeekActivity(sessions: FastSession[], now: number): ActivityDay[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    // Calendar arithmetic, rather than 24-hour subtraction, handles DST changes.
    date.setDate(today.getDate() - 6 + index);
    return { date, key: localDateKey(date), completedCount: 0, isToday: index === 6 };
  });
  const byDate = new Map(days.map((day) => [day.key, day]));
  const countedIds = new Set<string>();

  for (const session of sessions) {
    if (session.status !== "completed" || !session.endedAt || countedIds.has(session.id)) continue;
    const endedAt = Date.parse(session.endedAt);
    if (!Number.isFinite(endedAt) || endedAt > now) continue;
    const day = byDate.get(localDateKey(new Date(endedAt)));
    if (day) {
      day.completedCount += 1;
      countedIds.add(session.id);
    }
  }

  return days;
}
