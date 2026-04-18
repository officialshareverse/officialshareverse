import { useEffect, useId } from "react";
import { createPortal } from "react-dom";

export default function Drawer({
  open,
  onClose,
  eyebrow = "Quick actions",
  title,
  description,
  children,
  footer = null,
  className = "",
}) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="sv-drawer-backdrop" role="presentation">
      <button type="button" className="sv-drawer-overlay" aria-label="Close panel" onClick={onClose} />

      <section
        className={`sv-drawer-sheet ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
      >
        <div className="sv-drawer-handle" aria-hidden="true" />

        <div className="sv-drawer-header">
          <div>
            {eyebrow ? <p className="sv-eyebrow">{eyebrow}</p> : null}
            {title ? <h2 id={titleId} className="sv-drawer-title">{title}</h2> : null}
            {description ? (
              <p id={descriptionId} className="sv-drawer-description">
                {description}
              </p>
            ) : null}
          </div>

          <button type="button" onClick={onClose} className="sv-drawer-close">
            Done
          </button>
        </div>

        <div className="sv-drawer-body">{children}</div>

        {footer ? <div className="sv-drawer-footer">{footer}</div> : null}
      </section>
    </div>,
    document.body
  );
}
