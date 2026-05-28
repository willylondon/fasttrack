import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  actions?: ReactNode;
  className?: string;
  description: string;
  eyebrow?: string;
  preview?: ReactNode;
  title: string;
};

export function EmptyState({ actions, className, description, eyebrow, preview, title }: EmptyStateProps) {
  return (
    <div className={cn("glass-card rounded-[1.8rem] p-5 sm:p-6", className)}>
      {eyebrow ? (
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</p>
      ) : null}
      <h2 className="mt-3 font-[family:var(--font-heading)] text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
      {actions ? <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div> : null}
      {preview ? <div className="mt-6">{preview}</div> : null}
    </div>
  );
}
