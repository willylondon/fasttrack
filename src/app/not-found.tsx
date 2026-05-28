import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-3xl pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="glass-card rounded-[2rem] px-6 py-10 text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">FastTrack</p>
          <h1 className="mt-4 font-[family:var(--font-heading)] text-3xl font-semibold tracking-tight text-foreground">
            That page isn’t here.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Head back to your dashboard to start a window, review your history, or reconnect with your circle.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
              Go to dashboard
            </Link>
            <Link href="/history" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}>
              Open history
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
