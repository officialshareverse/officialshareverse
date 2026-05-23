export default function EmptyState({
  icon: Icon,
  title,
  description = "",
  actions = null,
  className = "",
}) {
  return (
    <div className={`sv-empty-state relative overflow-hidden rounded-[length:var(--sv-radius-card)] border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`.trim()}>
      <div className="absolute inset-0 pointer-events-none opacity-50 dark:opacity-20">
        <div className="absolute -top-10 -left-10 h-64 w-64 rounded-full bg-emerald-100/40 blur-3xl mix-blend-multiply dark:bg-emerald-500/20 dark:mix-blend-screen" />
        <div className="absolute -bottom-10 -right-10 h-64 w-64 rounded-full bg-slate-100/60 blur-3xl mix-blend-multiply dark:bg-slate-600/20 dark:mix-blend-screen" />
      </div>
      
      <div className="relative z-10 flex flex-col items-center">
        {Icon ? (
          <div className="relative mb-6 flex items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-slate-100 dark:bg-slate-800/50" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-[20px] bg-slate-50 text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
              <Icon className="h-7 w-7" />
            </div>
          </div>
        ) : null}
        
        <p className="text-base font-bold text-slate-950 dark:text-white">{title}</p>
        
        {description ? (
          <p className="mt-3 max-w-sm text-sm leading-7 text-slate-500 dark:text-slate-400">
            {description}
          </p>
        ) : null}
        
        {actions ? (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
