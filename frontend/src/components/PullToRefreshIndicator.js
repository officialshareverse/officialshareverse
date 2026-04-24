export default function PullToRefreshIndicator({
  progress = 0,
  isRefreshing = false,
  idleLabel = "Pull down to refresh",
  readyLabel = "Release to refresh",
  loadingLabel = "Refreshing...",
}) {
  const normalizedProgress = Math.max(0, Math.min(1, progress));
  const visible = isRefreshing || normalizedProgress > 0;
  const label = isRefreshing
    ? loadingLabel
    : normalizedProgress >= 1
      ? readyLabel
      : idleLabel;

  return (
    <div className={`sv-pull-indicator ${visible ? "is-visible" : ""}`.trim()} aria-hidden={!visible}>
      <div className="sv-pull-indicator-copy">
        <span>{label}</span>
      </div>
      <div className="sv-pull-indicator-track">
        <span
          className={isRefreshing ? "is-refreshing" : ""}
          style={{ transform: `scaleX(${isRefreshing ? 1 : normalizedProgress})` }}
        />
      </div>
    </div>
  );
}
