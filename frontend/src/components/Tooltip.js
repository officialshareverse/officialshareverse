import { Children, cloneElement, isValidElement, useId } from "react";

export default function Tooltip({
  content,
  children,
  side = "top",
  className = "",
}) {
  const tooltipId = useId();

  if (!content) {
    return children;
  }

  const child = Children.only(children);
  const trigger = isValidElement(child)
    ? cloneElement(child, {
        "aria-describedby": tooltipId,
      })
    : child;

  return (
    <span className={`sv-tooltip is-${side} ${className}`.trim()}>
      <span className="sv-tooltip-trigger">{trigger}</span>
      <span id={tooltipId} role="tooltip" className="sv-tooltip-content">
        {content}
      </span>
    </span>
  );
}
