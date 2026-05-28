export default function Loading() {
  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="glass-card rounded-[1.9rem] p-5">
          <div className="h-12 w-48 animate-pulse rounded-2xl bg-white/[0.08]" />
          <div className="mt-5 h-7 w-56 animate-pulse rounded-xl bg-white/[0.08]" />
          <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded-xl bg-white/[0.05]" />
        </div>
        <div className="glass-card rounded-[2rem] p-5">
          <div className="mx-auto h-64 w-64 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="mt-6 h-5 w-40 animate-pulse rounded-xl bg-white/[0.06]" />
          <div className="mt-3 h-4 w-full animate-pulse rounded-xl bg-white/[0.04]" />
          <div className="mt-2 h-4 w-3/4 animate-pulse rounded-xl bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}
