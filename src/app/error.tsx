"use client";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <div className="glass-card rounded-[2rem] px-6 py-10 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">FastTrack</p>
          <h1 className="mt-4 font-[family:var(--font-heading)] text-3xl font-semibold tracking-tight text-foreground">
            We hit a problem loading this view.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Your progress is safe. Try loading the page again, and if the issue keeps happening, return to
            the dashboard and retry once your connection is stable.
          </p>
          <button
            className="mt-8 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-[0_12px_28px_rgba(139,92,246,0.3)] transition active:scale-95"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
