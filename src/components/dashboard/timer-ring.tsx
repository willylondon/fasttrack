type TimerRingProps = {
  label: string;
  plannedMinutes: number;
  progress: number;
};

export function TimerRing({ label, plannedMinutes, progress }: TimerRingProps) {
  const safeProgress = Math.max(0, Math.min(100, progress));
  const radius = 108;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeProgress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 260 260" className="size-[260px] drop-shadow-[0_0_35px_rgba(139,92,246,0.25)]">
        <defs>
          <linearGradient id="fasttrack-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#22C55E" />
          </linearGradient>
        </defs>
        <circle cx="130" cy="130" r={radius} className="fill-transparent stroke-white/5" strokeWidth="18" />
        <circle
          cx="130"
          cy="130"
          r={radius}
          className="fill-transparent stroke-[url(#fasttrack-ring)] transition-all duration-500 ease-out"
          strokeWidth="18"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 130 130)"
        />
      </svg>
      <div className="absolute flex size-44 flex-col items-center justify-center rounded-full border border-white/10 bg-background/80 text-center shadow-[inset_0_0_40px_rgba(255,255,255,0.03)] backdrop-blur">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Progress</p>
        <p className="mt-3 font-[family:var(--font-heading)] text-5xl font-semibold tracking-tight">
          {safeProgress}%
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{Math.round(plannedMinutes / 60)} hour target</p>
      </div>
    </div>
  );
}
