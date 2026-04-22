import { useEffect, useId } from "react";
import { createPortal } from "react-dom";

export default function ActionDialog({
  open,
  onClose,
  onConfirm,
  eyebrow = "Confirm action",
  title,
  description = "",
  confirmLabel = "Confirm",
  confirmPendingLabel = "Working...",
  cancelLabel = "Cancel",
  tone = "default",
  inputLabel = "",
  inputPlaceholder = "",
  inputValue = "",
  onInputChange = () => {},
  confirmDisabled = false,
  multiline = false,
  isSubmitting = false,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();

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
      if (event.key === "Escape" && !isSubmitting) {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSubmitting, onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const InputTag = multiline ? "textarea" : "input";

  return createPortal(
    <div className="sv-modal-backdrop" role="presentation">
      <section
        className="sv-action-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
      >
        <div className="sv-action-dialog-shell">
          <div className="sv-action-dialog-header">
            <div className="sv-action-dialog-copy">
              {eyebrow ? <p className="sv-eyebrow">{eyebrow}</p> : null}
              {title ? (
                <h2 id={titleId} className="sv-action-dialog-title">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p id={descriptionId} className="sv-action-dialog-description">
                  {description}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="sv-action-dialog-close"
            >
              Close
            </button>
          </div>

          {inputLabel ? (
            <label className="sv-action-dialog-field" htmlFor={inputId}>
              <span>{inputLabel}</span>
              <InputTag
                id={inputId}
                value={inputValue}
                onChange={(event) => onInputChange(event.target.value)}
                placeholder={inputPlaceholder}
                className={`sv-input ${multiline ? "sv-action-dialog-textarea" : ""}`.trim()}
                rows={multiline ? 5 : undefined}
              />
            </label>
          ) : null}

          <div className="sv-action-dialog-actions">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="sv-action-dialog-button is-secondary"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirmDisabled || isSubmitting}
              className={`sv-action-dialog-button ${tone === "danger" ? "is-danger" : "is-primary"}`.trim()}
            >
              {isSubmitting ? confirmPendingLabel : confirmLabel}
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
