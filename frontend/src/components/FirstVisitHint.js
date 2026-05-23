import { useEffect, useState } from "react";
import { SparkIcon } from "./UiIcons";

/**
 * A dismissable first-visit hint banner that shows once per user per page.
 * Uses localStorage keyed by `sv-hint-seen-{storageKey}` to track dismissal.
 *
 * @param {string}   storageKey  Unique key per page, e.g. "explore", "wallet", "my-splits"
 * @param {string}   title       Bold heading text
 * @param {string}   body        Description text
 * @param {string}   [ctaLabel]  Optional CTA button label
 * @param {function} [onCta]     Optional CTA click handler
 * @param {React.ReactNode} [icon] Optional icon override
 */
export default function FirstVisitHint({
  storageKey,
  title,
  body,
  ctaLabel = "",
  onCta,
  icon,
}) {
  const [isVisible, setIsVisible] = useState(false);

  const fullKey = storageKey ? `sv-hint-seen-${storageKey}` : "";

  useEffect(() => {
    if (!fullKey) {
      return;
    }

    try {
      const wasSeen = window.localStorage.getItem(fullKey) === "1";
      if (!wasSeen) {
        setIsVisible(true);
      }
    } catch {
      // Storage unavailable — show the hint anyway.
      setIsVisible(true);
    }
  }, [fullKey]);

  const dismiss = () => {
    setIsVisible(false);

    if (fullKey) {
      try {
        window.localStorage.setItem(fullKey, "1");
      } catch {
        // Ignore storage write failures.
      }
    }
  };

  const handleCtaClick = () => {
    dismiss();
    onCta?.();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="sv-first-visit-hint sv-animate-rise" role="status">
      <div className="sv-first-visit-hint-icon" aria-hidden="true">
        {icon || <SparkIcon className="h-5 w-5" />}
      </div>

      <div className="sv-first-visit-hint-copy">
        <p className="sv-first-visit-hint-title">{title}</p>
        <p className="sv-first-visit-hint-body">{body}</p>
      </div>

      <div className="sv-first-visit-hint-actions">
        {ctaLabel && onCta ? (
          <button
            type="button"
            onClick={handleCtaClick}
            className="sv-first-visit-hint-cta"
          >
            {ctaLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          className="sv-first-visit-hint-dismiss"
          aria-label="Dismiss hint"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
