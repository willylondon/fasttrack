"use client";

import { forwardRef, useEffect, useRef, useState, type ComponentProps } from "react";
import { format } from "date-fns";

export type ShareCardFormat = "post" | "story";
export type ShareCardTheme = "dusk" | "daybreak";

export const SHARE_CARD_SIZES: Record<ShareCardFormat, { width: number; height: number }> = {
  post: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};

type ShareFastCardProps = {
  durationMinutes: number;
  startedAt: string;
  endedAt: string;
  plannedMinutes?: number | null;
  currentStreak?: number | null;
  totalFasts?: number | null;
  format?: ShareCardFormat;
  theme?: ShareCardTheme;
  showTimes?: boolean;
};

const THEMES: Record<
  ShareCardTheme,
  {
    background: string;
    ink: string;
    muted: string;
    faint: string;
    track: string;
    tick: string;
    arcFrom: string;
    arcTo: string;
    glow: string;
    chip: string;
  }
> = {
  dusk: {
    background:
      "radial-gradient(120% 60% at 50% 108%, rgba(244,180,154,0.34) 0%, rgba(244,180,154,0) 58%), linear-gradient(180deg, #15142B 0%, #221B4A 58%, #33265F 100%)",
    ink: "#FFF4EA",
    muted: "rgba(255,244,234,0.62)",
    faint: "rgba(255,244,234,0.38)",
    track: "rgba(255,244,234,0.09)",
    tick: "rgba(255,244,234,0.28)",
    arcFrom: "#A78BFA",
    arcTo: "#F4B49A",
    glow: "rgba(244,180,154,0.55)",
    chip: "rgba(255,244,234,0.08)",
  },
  daybreak: {
    background:
      "radial-gradient(110% 55% at 50% -8%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 60%), linear-gradient(180deg, #E4ECFF 0%, #EEE8FB 48%, #FBE3DA 100%)",
    ink: "#1E1B4B",
    muted: "rgba(30,27,75,0.64)",
    faint: "rgba(30,27,75,0.4)",
    track: "rgba(30,27,75,0.08)",
    tick: "rgba(30,27,75,0.24)",
    arcFrom: "#6D4FE0",
    arcTo: "#EE8A63",
    glow: "rgba(238,138,99,0.45)",
    chip: "rgba(30,27,75,0.06)",
  },
};

const DIAL_LABELS = [
  { hour: 0, label: "12am" },
  { hour: 6, label: "6am" },
  { hour: 12, label: "12pm" },
  { hour: 18, label: "6pm" },
];

function clockAngle(value: string | Date) {
  const date = new Date(value);
  return ((date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600) / 24) * 360;
}

function polar(center: number, radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return { x: center + radius * Math.sin(radians), y: center - radius * Math.cos(radians) };
}

function arcPath(center: number, radius: number, startDegrees: number, sweepDegrees: number) {
  const start = polar(center, radius, startDegrees);
  const end = polar(center, radius, startDegrees + sweepDegrees);
  const largeArc = sweepDegrees > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function durationParts(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  const parts: { value: string; unit: string }[] = [];

  if (hours > 0) parts.push({ value: String(hours), unit: "h" });
  if (remainder > 0 || hours === 0) parts.push({ value: hours > 0 ? String(remainder).padStart(2, "0") : String(remainder), unit: "m" });

  return parts;
}

function compactGoal(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatClock(value: string) {
  return format(new Date(value), "h:mm a").toLowerCase();
}

function FastWindowDial({
  size,
  durationMinutes,
  startedAt,
  endedAt,
  plannedMinutes,
  palette,
  idSuffix,
}: {
  size: number;
  durationMinutes: number;
  startedAt: string;
  endedAt: string;
  plannedMinutes?: number | null;
  palette: (typeof THEMES)[ShareCardTheme];
  idSuffix: string;
}) {
  const center = size / 2;
  const stroke = Math.round(size * 0.05);
  const radius = center - stroke * 2.6;
  const startAngle = clockAngle(startedAt);
  const fullDay = durationMinutes >= 24 * 60;
  const sweep = fullDay ? 359.99 : Math.max(1.5, (durationMinutes / (24 * 60)) * 360);
  const endPoint = polar(center, radius, startAngle + sweep);
  const startPoint = polar(center, radius, startAngle);
  const goalSweep = plannedMinutes ? (plannedMinutes / (24 * 60)) * 360 : null;
  const showGoal = goalSweep !== null && goalSweep < 360 && Math.abs(goalSweep - sweep) > 3;
  const goalInner = showGoal ? polar(center, radius - stroke * 0.95, startAngle + goalSweep) : null;
  const goalOuter = showGoal ? polar(center, radius + stroke * 0.95, startAngle + goalSweep) : null;
  const gradientId = `share-arc-${idSuffix}`;
  const glowId = `share-glow-${idSuffix}`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={startPoint.x} y1={startPoint.y} x2={endPoint.x} y2={endPoint.y}>
          <stop offset="0%" stopColor={palette.arcFrom} />
          <stop offset="100%" stopColor={palette.arcTo} />
        </linearGradient>
        <radialGradient id={glowId}>
          <stop offset="0%" stopColor={palette.glow} />
          <stop offset="100%" stopColor={palette.glow} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={center} cy={center} r={radius} fill="none" stroke={palette.track} strokeWidth={stroke} />

      {Array.from({ length: 24 }, (_, hour) => {
        const major = hour % 6 === 0;
        const outer = polar(center, radius - stroke * 0.85, (hour / 24) * 360);
        const inner = polar(center, radius - stroke * (major ? 1.45 : 1.2), (hour / 24) * 360);
        return (
          <line
            key={hour}
            x1={outer.x}
            y1={outer.y}
            x2={inner.x}
            y2={inner.y}
            stroke={palette.tick}
            strokeWidth={major ? 4 : 2.5}
            strokeLinecap="round"
          />
        );
      })}

      {DIAL_LABELS.map(({ hour, label }) => {
        const point = polar(center, radius + stroke * 1.75, (hour / 24) * 360);
        return (
          <text
            key={label}
            x={point.x}
            y={point.y}
            fill={palette.faint}
            fontSize={size * 0.036}
            fontWeight={500}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontFamily: "inherit" }}
          >
            {label}
          </text>
        );
      })}

      <path
        d={arcPath(center, radius, startAngle, sweep)}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={stroke}
        strokeLinecap="round"
      />

      {goalInner && goalOuter ? (
        <line x1={goalInner.x} y1={goalInner.y} x2={goalOuter.x} y2={goalOuter.y} stroke={palette.ink} strokeOpacity={0.7} strokeWidth={4} strokeLinecap="round" />
      ) : null}

      <circle cx={endPoint.x} cy={endPoint.y} r={stroke * 1.6} fill={`url(#${glowId})`} />
      <circle cx={endPoint.x} cy={endPoint.y} r={stroke * 0.36} fill={palette.ink} />
    </svg>
  );
}

export const ShareFastCard = forwardRef<HTMLDivElement, ShareFastCardProps>(function ShareFastCard(
  {
    durationMinutes,
    startedAt,
    endedAt,
    plannedMinutes,
    currentStreak,
    totalFasts,
    format: cardFormat = "post",
    theme = "dusk",
    showTimes = true,
  },
  ref
) {
  const palette = THEMES[theme];
  const { width, height } = SHARE_CARD_SIZES[cardFormat];
  const story = cardFormat === "story";
  const dialSize = story ? 860 : 720;
  const goalReached = plannedMinutes ? durationMinutes >= plannedMinutes : false;
  const sameDay = format(new Date(startedAt), "yyyy-MM-dd") === format(new Date(endedAt), "yyyy-MM-dd");
  const chips = [
    currentStreak && currentStreak >= 2 ? `${currentStreak}-day streak` : null,
    totalFasts && totalFasts >= 2 ? `${totalFasts} fasts tracked` : null,
  ].filter((chip): chip is string => Boolean(chip));

  return (
    <div
      ref={ref}
      className="relative flex flex-col overflow-hidden"
      style={{
        width,
        height,
        background: palette.background,
        color: palette.ink,
        fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
        fontFeatureSettings: '"tnum" 1, "ss01" 1',
        lineHeight: 1.2,
        padding: story ? "120px 96px 112px" : "80px 88px 76px",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center" style={{ gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- html-to-image needs a plain same-origin image to inline */}
          <img alt="" src="/icon-192.png" width={64} height={64} style={{ width: 64, height: 64, borderRadius: 18 }} />
          <span style={{ fontSize: 36, fontWeight: 650, letterSpacing: "-0.02em" }}>FastTrack</span>
        </div>
        <span style={{ fontSize: 30, fontWeight: 500, color: palette.muted }}>{format(new Date(endedAt), "EEE, MMM d")}</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative flex items-center justify-center" style={{ width: dialSize, height: dialSize }}>
          <FastWindowDial
            size={dialSize}
            durationMinutes={durationMinutes}
            startedAt={startedAt}
            endedAt={endedAt}
            plannedMinutes={plannedMinutes}
            palette={palette}
            idSuffix={`${cardFormat}-${theme}`}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="flex items-baseline" style={{ gap: story ? 22 : 16, lineHeight: 1 }}>
              {durationParts(durationMinutes).map((part) => (
                <span key={part.unit} className="flex items-baseline">
                  <span style={{ fontSize: story ? 148 : 118, fontWeight: 650, letterSpacing: "-0.055em" }}>{part.value}</span>
                  <span style={{ fontSize: story ? 60 : 50, fontWeight: 450, color: palette.muted, marginLeft: 6, letterSpacing: "-0.02em" }}>
                    {part.unit}
                  </span>
                </span>
              ))}
            </p>
            <p style={{ marginTop: story ? 28 : 20, fontSize: story ? 38 : 32, fontWeight: 500, color: palette.muted }}>
              {plannedMinutes
                ? goalReached
                  ? `${compactGoal(plannedMinutes)} goal reached`
                  : `of a ${compactGoal(plannedMinutes)} goal`
                : "fasted"}
            </p>
          </div>
        </div>

        {showTimes ? (
          <div className="grid w-full grid-cols-2" style={{ marginTop: story ? 88 : 40, maxWidth: 820 }}>
            <div>
              <p style={{ fontSize: 28, color: palette.faint, fontWeight: 500 }}>Started</p>
              <p style={{ marginTop: 8, fontSize: 48, fontWeight: 600, letterSpacing: "-0.03em" }}>
                {formatClock(startedAt)}
                {!sameDay ? (
                  <span style={{ fontSize: 30, fontWeight: 500, color: palette.muted, marginLeft: 14 }}>
                    {format(new Date(startedAt), "EEE")}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="text-right">
              <p style={{ fontSize: 28, color: palette.faint, fontWeight: 500 }}>Broke fast</p>
              <p style={{ marginTop: 8, fontSize: 48, fontWeight: 600, letterSpacing: "-0.03em" }}>{formatClock(endedAt)}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-end justify-between" style={{ gap: 24, minHeight: 64 }}>
        <div className="flex flex-wrap" style={{ gap: 14 }}>
          {chips.map((chip) => (
            <span
              key={chip}
              style={{ background: palette.chip, borderRadius: 999, padding: "14px 26px", fontSize: 28, fontWeight: 550 }}
            >
              {chip}
            </span>
          ))}
        </div>
        <span style={{ fontSize: 26, color: palette.faint, fontWeight: 500, whiteSpace: "nowrap" }}>Tracked with FastTrack</span>
      </div>
    </div>
  );
});

/** Renders the full-size card scaled down to fit its container width. */
export function ShareFastCardPreview(props: Omit<ComponentProps<typeof ShareFastCard>, "ref">) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const { width, height } = SHARE_CARD_SIZES[props.format ?? "post"];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => setScale(container.clientWidth / width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="relative w-full overflow-hidden rounded-[1.25rem] shadow-[0_18px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/10"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {scale > 0 ? (
        <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
          <ShareFastCard {...props} />
        </div>
      ) : null}
    </div>
  );
}
