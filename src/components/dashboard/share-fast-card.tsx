"use client";

import { forwardRef } from "react";
import { format } from "date-fns";

import { formatDuration } from "@/lib/fasting";

type ShareFastCardProps = {
  durationMinutes: number;
  startedAt: string;
  endedAt: string;
  plannedMinutes?: number | null;
  milestoneLabel?: string | null;
};

function formatLongDuration(minutes: number) {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  }

  if (remainder > 0 || parts.length === 0) {
    parts.push(`${remainder} minute${remainder === 1 ? "" : "s"}`);
  }

  return parts.join(", ");
}

function formatTime(value: string) {
  return format(new Date(value), "h:mm a");
}

export const ShareFastCard = forwardRef<HTMLDivElement, ShareFastCardProps>(function ShareFastCard(
  { durationMinutes, startedAt, endedAt, plannedMinutes, milestoneLabel },
  ref
) {
  return (
    <div
      ref={ref}
      className="flex h-[1350px] w-[1080px] flex-col overflow-hidden rounded-[64px] border border-white/10 bg-[#0b0b0b] text-white"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(245,158,11,0.12), transparent 28%), radial-gradient(circle at top right, rgba(139,92,246,0.22), transparent 34%), linear-gradient(180deg, #17141f 0%, #0b0b0b 62%, #09090b 100%)",
        boxShadow: "0 44px 120px rgba(0, 0, 0, 0.42)",
      }}
    >
      <div className="flex flex-1 flex-col px-20 pb-16 pt-16 text-center">
        <div className="flex flex-col items-center">
          <div className="flex size-20 items-center justify-center rounded-[28px] bg-[linear-gradient(135deg,#8B5CF6_0%,#34d399_100%)] shadow-[0_20px_46px_rgba(139,92,246,0.28)]">
            <div className="size-8 rounded-full border-[6px] border-white/90" />
          </div>
          <p className="mt-7 font-[family:var(--font-heading)] text-[64px] font-semibold tracking-tight text-white">
            FastTrack
          </p>
          <p className="mt-4 text-[20px] uppercase tracking-[0.44em] text-white/45">Completed session</p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center">
          <p className="text-[28px] uppercase tracking-[0.32em] text-white/60">I just finished a fast</p>
          <h1 className="mt-10 max-w-[900px] font-[family:var(--font-heading)] text-[148px] font-semibold leading-[0.92] tracking-[-0.05em] text-white">
            {formatLongDuration(durationMinutes)}
          </h1>

          <div className="mt-14 grid w-full max-w-[920px] grid-cols-2 gap-5 text-left">
            <div className="rounded-[32px] border border-white/10 bg-white/[0.04] px-8 py-6">
              <p className="text-[18px] uppercase tracking-[0.28em] text-white/50">Started</p>
              <p className="mt-3 text-[42px] font-medium tracking-tight text-white">{formatTime(startedAt)}</p>
            </div>
            <div className="rounded-[32px] border border-white/10 bg-white/[0.04] px-8 py-6">
              <p className="text-[18px] uppercase tracking-[0.28em] text-white/50">Ended</p>
              <p className="mt-3 text-[42px] font-medium tracking-tight text-white">{formatTime(endedAt)}</p>
            </div>
          </div>

          {plannedMinutes || milestoneLabel ? (
            <div className="mt-5 flex w-full max-w-[920px] flex-wrap items-center justify-center gap-4">
              {plannedMinutes ? (
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-7 py-4 text-[24px] font-medium tracking-tight text-white/88">
                  Planned {formatDuration(plannedMinutes)} / Completed {formatDuration(durationMinutes)}
                </div>
              ) : null}
              {milestoneLabel ? (
                <div className="rounded-full border border-primary/25 bg-primary/12 px-7 py-4 text-[24px] font-medium tracking-tight text-white/88">
                  {milestoneLabel}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-end justify-between gap-10 pt-10">
          <p className="max-w-[460px] text-left text-[24px] leading-[1.4] text-white/58">
            Track your window. Stay consistent.
          </p>
          <p className="max-w-[280px] text-right text-[20px] uppercase tracking-[0.18em] leading-[1.2] text-white/58">
            Tracked with FastTrack
          </p>
        </div>
      </div>
    </div>
  );
});
