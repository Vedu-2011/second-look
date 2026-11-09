import { cn } from "@/lib/utils";

export function StepIndicator({
  step,
  total = 2,
  title,
  className,
}: {
  step: number;
  total?: number;
  title: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-[width,background-color] duration-300",
              i + 1 < step && "w-8 bg-ink",
              i + 1 === step && "w-12 bg-amber",
              i + 1 > step && "w-8 bg-foil-deep",
            )}
          />
        ))}
      </div>
      <p className="text-base font-semibold text-ink-soft">
        Step {step} of {total}
      </p>
      <h1 className="-mt-1 text-3xl font-bold tracking-[-0.015em] text-balance text-ink">{title}</h1>
    </div>
  );
}
