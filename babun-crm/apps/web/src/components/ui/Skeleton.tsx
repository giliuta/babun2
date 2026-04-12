"use client";

interface SkeletonProps {
  className?: string;
  rounded?: "sm" | "md" | "lg" | "full";
}

// Single shimmering placeholder block. Uses a CSS linear-gradient
// animation so it costs almost nothing to render.
export default function Skeleton({ className = "", rounded = "md" }: SkeletonProps) {
  const r =
    rounded === "full"
      ? "rounded-full"
      : rounded === "lg"
        ? "rounded-xl"
        : rounded === "sm"
          ? "rounded"
          : "rounded-md";
  return (
    <div
      className={`skeleton-shimmer ${r} ${className}`}
      aria-hidden="true"
    />
  );
}

// Convenience row used on list pages — avatar + two text lines
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="w-10 h-10" rounded="full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-2.5 w-3/5" />
      </div>
    </div>
  );
}
