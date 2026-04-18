export default function EmptyState({
  icon: Icon,
  title,
  description = "",
  actions = null,
  className = "",
}) {
  return (
    <div className={`sv-empty-state ${className}`.trim()}>
      {Icon ? (
        <div className="sv-empty-icon">
          <Icon className="h-6 w-6" />
        </div>
      ) : null}
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description ? (
        <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
      ) : null}
      {actions ? <div className="mt-4 flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
