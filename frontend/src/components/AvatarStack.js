import Tooltip from "./Tooltip";

export default function AvatarStack({
  items,
  max = 4,
  className = "",
  chipClassName = "",
  showOverflow = true,
}) {
  const safeItems = Array.isArray(items) ? items : [];
  const visibleItems = safeItems.slice(0, max);
  const overflowCount = Math.max(0, safeItems.length - max);

  return (
    <div className={`sv-avatar-stack ${className}`.trim()}>
      {visibleItems.map((item, index) => (
        <Tooltip
          key={item.id || `${item.label || "avatar"}-${index}`}
          content={item.title || item.label || ""}
        >
          <span className={`sv-avatar-chip ${chipClassName} ${item.className || ""}`.trim()}>
            {item.initials || item.label || "SV"}
            {item.indicatorClassName ? (
              <span className={`sv-avatar-chip-dot ${item.indicatorClassName}`.trim()} />
            ) : null}
          </span>
        </Tooltip>
      ))}

      {showOverflow && overflowCount > 0 ? (
        <Tooltip content={`${overflowCount} more`}>
          <span className={`sv-avatar-chip ${chipClassName}`.trim()}>+{overflowCount}</span>
        </Tooltip>
      ) : null}
    </div>
  );
}
