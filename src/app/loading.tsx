export default function Loading() {
  return (
    <div className="min-h-screen px-4 pb-28 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-6 sm:pt-[calc(env(safe-area-inset-top)+1rem)]">
      <div className="mx-auto flex max-w-[880px] flex-col gap-5">
        <div className="glass-card rounded-[1.9rem] p-4">
          <div className="flex items-center justify-between">
            <div className="h-10 w-36 animate-pulse rounded-2xl bg-white/[0.08]" />
            <div className="h-9 w-20 animate-pulse rounded-xl bg-white/[0.08]" />
          </div>
        </div>
        <div className="surface-primary rounded-[1.75rem] p-4 sm:p-6">
          <div className="h-8 w-44 animate-pulse rounded-xl bg-white/[0.08]" />
          <div className="mx-auto mt-4 h-56 w-56 animate-pulse rounded-full bg-white/[0.06] sm:h-72 sm:w-72" />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="h-14 animate-pulse rounded-2xl bg-white/[0.05]" key={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
