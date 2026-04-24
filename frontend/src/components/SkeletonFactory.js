export function SkeletonBlock({ className = "" }) {
  return <div className={`sv-skeleton ${className}`.trim()} aria-hidden="true" />;
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
    <div className={`space-y-4 ${className}`.trim()}>
      <SkeletonBlock className={`h-4 ${eyebrowWidth}`.trim()} />
      <SkeletonBlock className={`h-10 rounded-[18px] ${titleWidth}`.trim()} />
      {bodyWidths.map((width, index) => (
        <SkeletonBlock key={`${width}-${index}`} className={`h-4 ${width}`.trim()} />
      ))}
    </div>
  );
}

export function SkeletonHero({ className = "h-64 rounded-[24px] sm:h-80" }) {
  return <SkeletonBlock className={className} />;
}

export function SkeletonMetricGrid({
  count = 4,
  className = "grid gap-4 sm:grid-cols-4",
  cardClassName = "",
}) {
  return (
    <section className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} className={`space-y-4 ${cardClassName}`.trim()}>
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-8 w-20 rounded-[16px]" />
        </SkeletonCard>
      ))}
    </section>
  );
}

export function SkeletonList({
  count = 4,
  className = "space-y-4",
  itemClassName = "h-24 rounded-[22px]",
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonBlock key={index} className={itemClassName} />
      ))}
    </div>
  );
}
