export function Skeleton({ className = "" }) {
  return <div className={`sv-skeleton ${className}`.trim()} aria-hidden="true" />;
}

export function SkeletonBlock({ className = "" }) {
  return <Skeleton className={className} />;
}

export function SkeletonCard({ className = "", children }) {
  return <div className={`sv-skeleton-card ${className}`.trim()}>{children}</div>;
}

export function SkeletonTextGroup({
  className = "",
  eyebrowWidth = "w-24",
  titleWidth = "w-3/4",
  bodyWidths = ["w-full", "w-5/6"],
}) {
  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <Skeleton className={`h-3 ${eyebrowWidth}`.trim()} />
      <Skeleton className={`h-7 ${titleWidth}`.trim()} />
      {bodyWidths.map((width, index) => (
        <Skeleton key={`${width}-${index}`} className={`h-3 ${width}`.trim()} />
      ))}
    </div>
  );
}

export function SkeletonHero({ className = "h-40 rounded-xl" }) {
  return <Skeleton className={className} />;
}

export function SkeletonList({
  count = 4,
  className = "space-y-3",
  itemClassName = "h-20 rounded-xl",
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className={itemClassName} />
      ))}
    </div>
  );
}

export function SkeletonMetricGrid({
  count = 4,
  className = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4",
  cardClassName = "space-y-3",
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} className={cardClassName}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-20" />
        </SkeletonCard>
      ))}
    </div>
  );
}
