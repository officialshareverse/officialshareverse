import { Children, cloneElement, isValidElement, useEffect, useId, useState } from "react";

export default function Tooltip({
  content,
  title = "",
  children,
  side = "top",
  className = "",
  guided = false,
  storageKey = "",
  defaultOpen = false,
  actionLabel = "Got it",
}) {
  const tooltipId = useId();
  const [isGuidedOpen, setIsGuidedOpen] = useState(false);

  useEffect(() => {
    if (!guided) {
      setIsGuidedOpen(false);
      return;
    }

    if (typeof window === "undefined") {
      setIsGuidedOpen(defaultOpen);
      return;
    }

    if (!storageKey) {
      setIsGuidedOpen(defaultOpen);
      return;
    }

    try {
      setIsGuidedOpen(window.localStorage.getItem(storageKey) !== "1");
    } catch {
      setIsGuidedOpen(defaultOpen);
    }
  }, [defaultOpen, guided, storageKey]);

  if (!content) {
    return children;
  }

  const dismissGuidedTooltip = () => {
    if (typeof window !== "undefined" && storageKey) {
      try {
        window.localStorage.setItem(storageKey, "1");
      } catch {
        // Ignore storage failures so the hint can still close.
      }
    }
    setIsGuidedOpen(false);
  };

  const child = Children.only(children);
  const trigger = isValidElement(child)
    ? cloneElement(child, {
        "aria-describedby": tooltipId,
      })
    : child;

  return (
    <span
      className={`sv-tooltip is-${side} ${guided ? "is-guided" : ""} ${
        isGuidedOpen ? "is-open" : ""
      } ${className}`.trim()}
    >
      <span className="sv-tooltip-trigger">{trigger}</span>
      <span id={tooltipId} role="tooltip" className="sv-tooltip-content">
        {guided ? (
          <span className="sv-tooltip-guided-inner">
            {title ? <strong>{title}</strong> : null}
            <span>{content}</span>
            <button type="button" onClick={dismissGuidedTooltip}>
              {actionLabel}
            </button>
          </span>
        ) : (
          content
        )}
      </span>
    </span>
  );
}
