import { createContext, useContext, useEffect, useRef, useState } from "react";

import { CheckCircleIcon, ClockIcon, ShieldIcon, SparkIcon } from "./UiIcons";

const ToastContext = createContext(null);

const TOAST_DEFAULT_TITLES = {
  success: "Done",
  error: "Something went wrong",
  warning: "Heads up",
  info: "ShareVerse",
};

let toastSequence = 0;

function createToast(tone, message, options = {}) {
  return {
    id: `sv-toast-${Date.now()}-${toastSequence++}`,
    tone,
    title: options.title || TOAST_DEFAULT_TITLES[tone] || TOAST_DEFAULT_TITLES.info,
    message,
    duration: options.duration ?? (tone === "error" ? 5600 : 4200),
  };
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const apiRef = useRef(null);

  if (!apiRef.current) {
    apiRef.current = {
      show(message, options = {}) {
        if (!message) {
          return null;
        }

        const nextToast = createToast(options.tone || "info", message, options);
        setToasts((current) => [...current, nextToast].slice(-4));
        return nextToast.id;
      },
      success(message, options = {}) {
        if (!message) {
          return null;
        }

        const nextToast = createToast("success", message, options);
        setToasts((current) => [...current, nextToast].slice(-4));
        return nextToast.id;
      },
      error(message, options = {}) {
        if (!message) {
          return null;
        }

        const nextToast = createToast("error", message, options);
        setToasts((current) => [...current, nextToast].slice(-4));
        return nextToast.id;
      },
      warning(message, options = {}) {
        if (!message) {
          return null;
        }

        const nextToast = createToast("warning", message, options);
        setToasts((current) => [...current, nextToast].slice(-4));
        return nextToast.id;
      },
      info(message, options = {}) {
        if (!message) {
          return null;
        }

        const nextToast = createToast("info", message, options);
        setToasts((current) => [...current, nextToast].slice(-4));
        return nextToast.id;
      },
      dismiss(id) {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      },
      clear() {
        setToasts([]);
      },
    };
  }

  const api = apiRef.current;

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div className="sv-toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={api.dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.");
  }
  return context;
}

function ToastCard({ toast, onDismiss }) {
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [onDismiss, toast.duration, toast.id]);

  const toneConfig =
    toast.tone === "success"
      ? { icon: CheckCircleIcon, className: "is-success" }
      : toast.tone === "error"
        ? { icon: ShieldIcon, className: "is-error" }
        : toast.tone === "warning"
          ? { icon: ClockIcon, className: "is-warning" }
          : { icon: SparkIcon, className: "is-info" };

  const Icon = toneConfig.icon;

  return (
    <div className={`sv-toast ${toneConfig.className}`} role="status">
      <div className="sv-toast-icon">
        <Icon className="h-4.5 w-4.5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="sv-toast-title">{toast.title}</p>
        <p className="sv-toast-message">{toast.message}</p>
      </div>

      <button type="button" onClick={() => onDismiss(toast.id)} className="sv-toast-close" aria-label="Dismiss notification">
        Dismiss
      </button>

      <span className="sv-toast-progress" style={{ "--sv-toast-duration": `${toast.duration}ms` }} aria-hidden="true" />
    </div>
  );
}
