function iconProps({ className = "h-5 w-5", strokeWidth = 1.9 } = {}) {
  return {
    className,
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };
}

export function HomeIcon(props) {
  return (
    <svg {...iconProps(props)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </svg>
  );
}

export function CompassIcon(props) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m14.9 9.1-4.2 1.8-1.6 4 4-1.6 1.8-4.2Z" />
    </svg>
  );
}

export function PlusIcon(props) {
  return (
    <svg {...iconProps(props)}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function LayersIcon(props) {
  return (
    <svg {...iconProps(props)}>
      <path d="m12 3 9 4.5-9 4.5L3 7.5 12 3Z" />
      <path d="m3 12 9 4.5 9-4.5" />
      <path d="m3 16.5 9 4.5 9-4.5" />
    </svg>
  );
}

export function BellIcon(props) {
  return (
    <svg {...iconProps(props)}>
      <path d="M14 19a2 2 0 0 1-4 0" />
      <path d="M5 17h14c-1.4-1.3-2.3-3.2-2.3-5.2V10a4.7 4.7 0 1 0-9.4 0v1.8c0 2-.9 3.9-2.3 5.2Z" />
    </svg>
  );
}

export function ChatIcon(props) {
  return (
    <svg {...iconProps(props)}>
      <path d="M20 14a3 3 0 0 1-3 3H9l-5 4V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3Z" />
      <path d="M8.5 10.5h7" />
      <path d="M8.5 14h4.5" />
    </svg>
  );
}

export function WalletIcon(props) {
  return (
    <svg {...iconProps(props)}>
      <path d="M4 7.5h14a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7.5Z" />
      <path d="M4 8V6a2 2 0 0 1 2-2h11" />
      <path d="M16 13h4" />
      <circle cx="16" cy="13" r=".5" fill="currentColor" />
    </svg>
  );
}

export function UserIcon(props) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function SearchIcon(props) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function SparkIcon(props) {
  return (
    <svg {...iconProps(props)}>
      <path d="m12 3 1.1 3.3L16.5 7.5l-3.4 1.2L12 12l-1.1-3.3L7.5 7.5l3.4-1.2L12 3Z" />
      <path d="m18.5 13.5.6 1.8 1.9.7-1.9.6-.6 1.9-.7-1.9-1.8-.6 1.8-.7.7-1.8Z" />
      <path d="m6 14 .8 2.4 2.5.8-2.5.8L6 20.5l-.8-2.5-2.4-.8 2.4-.8L6 14Z" />
    </svg>
  );
}

export function ClockIcon(props) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function CheckCircleIcon(props) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12 2.2 2.2 4.8-4.8" />
    </svg>
  );
}

export function ShieldIcon(props) {
  return (
    <svg {...iconProps(props)}>
      <path d="M12 3.5 5 6.5v5.8c0 4 2.8 6.8 7 8.2 4.2-1.4 7-4.2 7-8.2V6.5l-7-3Z" />
      <path d="m9.5 12 1.6 1.6 3.4-3.4" />
    </svg>
  );
}

export function CreditIcon(props) {
  return (
    <svg {...iconProps(props)}>
      <path d="m4 12 4-4" />
      <path d="m8 8 3 0" />
      <path d="m4 12 0-3" />
      <path d="m20 12-4 4" />
      <path d="m16 16-3 0" />
      <path d="m20 12 0 3" />
    </svg>
  );
}

export function DebitIcon(props) {
  return (
    <svg {...iconProps(props)}>
      <path d="m8 6-4 6 4 6" />
      <path d="M4 12h16" />
    </svg>
  );
}

export function BankIcon(props) {
  return (
    <svg {...iconProps(props)}>
      <path d="M3 9h18" />
      <path d="M4.5 9V19" />
      <path d="M9 9V19" />
      <path d="M15 9V19" />
      <path d="M19.5 9V19" />
      <path d="m12 4 9 4H3l9-4Z" />
      <path d="M3 19h18" />
    </svg>
  );
}

export function StarIcon(props) {
  return (
    <svg {...iconProps(props)}>
      <path d="m12 3 2.5 5.1 5.6.8-4 3.9.9 5.5-5-2.6-5 2.6.9-5.5-4-3.9 5.6-.8L12 3Z" />
    </svg>
  );
}

export function LoadingSpinner({ className = "h-4 w-4" }) {
  return <span className={`sv-spinner ${className}`} aria-hidden="true" />;
}

export function SkeletonBlock({ className = "" }) {
  return <div className={`sv-skeleton ${className}`.trim()} aria-hidden="true" />;
}

export function ProgressRing({
  value = 0,
  size = 108,
  stroke = 8,
  trackColor = "rgba(148, 163, 184, 0.18)",
  progressColor = "url(#sv-ring-gradient)",
  label,
}) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  return (
    <span className="sv-ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id="sv-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <circle cx={center} cy={center} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      {label ? <span className="sv-ring-label">{label}</span> : null}
    </span>
  );
}

export function RatingStars({ rating = 0, count = 5 }) {
  const normalized = Math.max(0, Math.min(count, Number(rating) || 0));
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: count }).map((_, index) => {
        const filled = normalized >= index + 1;
        const half = !filled && normalized > index && normalized < index + 1;
        return (
          <span key={index} className={`inline-flex ${filled || half ? "text-amber-500" : "text-slate-300"}`}>
            <StarIcon className="h-4 w-4" />
          </span>
        );
      })}
    </div>
  );
}
