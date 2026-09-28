import { cn } from "@/lib/utils";

/** Couleurs d'acte, résolues depuis le jeton du référentiel. */
export const ACT_COLORS: Record<string, { bar: string; chip: string; ring: string }> = {
  teal: {
    bar: "bg-teal-500/15 border-teal-500/40",
    chip: "bg-teal-500/20 text-teal-700 dark:text-teal-300",
    ring: "ring-teal-500/50",
  },
  orange: {
    bar: "bg-orange-500/15 border-orange-500/40",
    chip: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
    ring: "ring-orange-500/50",
  },
  violet: {
    bar: "bg-violet-500/15 border-violet-500/40",
    chip: "bg-violet-500/20 text-violet-700 dark:text-violet-300",
    ring: "ring-violet-500/50",
  },
};

export function actColor(color: string) {
  return ACT_COLORS[color] ?? ACT_COLORS.teal!;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-20 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-1 focus-visible:outline-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: "muted" | "accent" | "warn" | "ok";
  className?: string;
}) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    accent: "bg-primary/15 text-primary",
    warn: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    ok: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-border/60 text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center text-sm">
      <p className="text-foreground font-medium">{title}</p>
      {hint ? <p className="max-w-md">{hint}</p> : null}
      {action}
    </div>
  );
}

/** Barre de couverture : combien d'étapes d'un acte portent une note. */
export function CoverageBar({
  covered,
  total,
  color = "teal",
}: {
  covered: number;
  total: number;
  color?: string;
}) {
  const pct = total === 0 ? 0 : Math.round((covered / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full transition-all", {
            "bg-teal-500": color === "teal",
            "bg-orange-500": color === "orange",
            "bg-violet-500": color === "violet",
          })}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {covered}/{total}
      </span>
    </div>
  );
}
