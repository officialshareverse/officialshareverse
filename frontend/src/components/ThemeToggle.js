function SunIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.54 5.46l-1.77 1.77M7.23 16.77l-1.77 1.77M18.54 18.54l-1.77-1.77M7.23 7.23 5.46 5.46"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M20 14.25A8.25 8.25 0 0 1 9.75 4a8.5 8.5 0 1 0 10.25 10.25Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ThemeToggle({
  themeMode = "light",
  onToggle,
  compact = false,
  className = "",
}) {
  const isDark = themeMode === "dark";
  const nextModeLabel = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={onToggle}
      title={`Switch to ${nextModeLabel} mode`}
      className={`sv-theme-toggle ${compact ? "sv-theme-toggle-compact" : ""} ${className}`.trim()}
      aria-label={`Switch to ${nextModeLabel} mode`}
      aria-pressed={isDark}
    >
      <span className="sv-theme-toggle-icon">
        {isDark ? <SunIcon /> : <MoonIcon />}
      </span>
      {compact ? null : <span>{isDark ? "Light" : "Dark"}</span>}
    </button>
  );
}
