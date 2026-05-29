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
      <div className="flex items-center justify-between px-20 pt-20">
        <div className="flex items-center gap-5">
          <div className="flex size-20 items-center justify-center rounded-[28px] bg-[linear-gradient(135deg,#8B5CF6_0%,#34d399_100%)] shadow-[0_20px_46px_rgba(139,92,246,0.28)]">
            <div className="size-8 rounded-full border-[6px] border-white/90" />
          </div>
          <div>
            <p className="font-[family:var(--font-heading)] text-[52px] font-semibold tracking-tight">FastTrack</p>
            <p className="mt-2 text-[24px] uppercase tracking-[0.38em] text-white/55">Completed session</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between px-20 pb-20 pt-16">
        <div>
          <p className="text-[28px] uppercase tracking-[0.38em] text-white/55">I just finished a fast</p>
          <h1 className="mt-8 max-w-[760px] font-[family:var(--font-heading)] text-[128px] font-semibold leading-[0.92] tracking-tight text-white">
            {formatLongDuration(durationMinutes)}
          </h1>

          <div className="mt-16 space-y-5">
            <div className="rounded-[36px] border border-white/10 bg-white/[0.04] px-8 py-7">
              <p className="text-[22px] uppercase tracking-[0.28em] text-white/55">Started</p>
              <p className="mt-4 text-[54px] font-medium tracking-tight">{formatTime(startedAt)}</p>
            </div>
            <div className="rounded-[36px] border border-white/10 bg-white/[0.04] px-8 py-7">
              <p className="text-[22px] uppercase tracking-[0.28em] text-white/55">Ended</p>
              <p className="mt-4 text-[54px] font-medium tracking-tight">{formatTime(endedAt)}</p>
            </div>
            {plannedMinutes ? (
              <div className="rounded-[36px] border border-white/10 bg-white/[0.04] px-8 py-7">
                <p className="text-[22px] uppercase tracking-[0.28em] text-white/55">Window</p>
                <p className="mt-4 text-[42px] font-medium tracking-tight text-white">
                  Planned {formatDuration(plannedMinutes)} / Completed {formatDuration(durationMinutes)}
                </p>
              </div>
            ) : null}
            {milestoneLabel ? (
              <div className="rounded-[36px] border border-primary/25 bg-primary/10 px-8 py-7">
                <p className="text-[22px] uppercase tracking-[0.28em] text-white/55">Checkpoint reached</p>
                <p className="mt-4 text-[42px] font-medium tracking-tight text-white">{milestoneLabel}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-end justify-between gap-10">
          <p className="max-w-[580px] text-[28px] leading-[1.45] text-white/62">
            Build your streak. Track your window. Stay accountable.
          </p>
          <p className="text-[28px] uppercase tracking-[0.32em] text-white/62">Tracked with FastTrack</p>
        </div>
      </div>
    </div>
  );
});
