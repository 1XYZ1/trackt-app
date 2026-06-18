import type React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "animate-skeleton rounded-sm [--skeleton-base:--alpha(var(--color-black)/6%)] [--skeleton-highlight:--alpha(var(--color-white)/64%)] [background:linear-gradient(120deg,transparent_40%,var(--skeleton-highlight),transparent_60%)_var(--skeleton-base)_0_0/200%_100%_fixed] dark:[--skeleton-base:--alpha(var(--color-white)/8%)] dark:[--skeleton-highlight:--alpha(var(--color-white)/10%)]",
        className,
      )}
      data-slot="skeleton"
      {...props}
    />
  );
}
