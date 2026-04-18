import { useEffect, useRef, useState } from "react";

import API from "../api/axios";

const GOOGLE_CLIENT_ID = (process.env.REACT_APP_GOOGLE_CLIENT_ID || "").trim();
let googleScriptPromise = null;

function extractGoogleAuthError(error) {
  const errorData = error?.response?.data;
  if (errorData && typeof errorData === "object") {
    if (typeof errorData.error === "string" && errorData.error.trim()) {
      return errorData.error;
    }

    const firstField = Object.values(errorData)[0];
    if (Array.isArray(firstField) && firstField.length > 0) {
      return firstField[0];
    }
    if (typeof firstField === "string" && firstField.trim()) {
      return firstField;
    }
  }

  return "Google sign-in is unavailable right now. Please try again.";
}

function loadGoogleIdentityScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google sign-in is only available in the browser."));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google);
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Google sign-in.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Failed to load Google sign-in."));
    document.head.appendChild(script);
  });

  return googleScriptPromise.catch((error) => {
    googleScriptPromise = null;
    throw error;
  });
}

function GoogleMarkIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.24 1.26-.96 2.33-2.04 3.06l3.3 2.55c1.92-1.77 3.03-4.38 3.03-7.5 0-.72-.06-1.41-.18-2.07H12Z"
      />
      <path
        fill="#34A853"
        d="M12 21.5c2.7 0 4.95-.9 6.6-2.43l-3.3-2.55c-.9.6-2.07.99-3.3.99-2.55 0-4.71-1.71-5.49-4.02H3.12v2.64A9.96 9.96 0 0 0 12 21.5Z"
      />
      <path
        fill="#4A90E2"
        d="M6.51 13.49A5.98 5.98 0 0 1 6.21 11.7c0-.63.12-1.23.3-1.79V7.27H3.12A10 10 0 0 0 2 11.7c0 1.62.39 3.15 1.12 4.43l3.39-2.64Z"
      />
      <path
        fill="#FBBC05"
        d="M12 5.88c1.47 0 2.79.51 3.84 1.5l2.88-2.88C16.95 2.88 14.7 2 12 2 8.13 2 4.8 4.22 3.12 7.27l3.39 2.64C7.29 7.59 9.45 5.88 12 5.88Z"
      />
    </svg>
  );
}

export default function GoogleAuthButton({
  mode = "signin",
  themeMode = "light",
  disabled = false,
  title = "Continue with Google",
  description = "",
  note = "",
  className = "",
  onSuccess,
  onError,
}) {
  const wrapperRef = useRef(null);
  const slotRef = useRef(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const [status, setStatus] = useState(GOOGLE_CLIENT_ID ? "loading" : "unavailable");

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onError, onSuccess]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setStatus("unavailable");
      return undefined;
    }

    if (disabled) {
      setStatus("disabled");
      return undefined;
    }

    let cancelled = false;
    const slotElement = slotRef.current;
    const wrapperElement = wrapperRef.current;

    if (!slotElement || !wrapperElement) {
      setStatus("error");
      return undefined;
    }

    const initializeGoogleButton = async () => {
      try {
        setStatus("loading");
        await loadGoogleIdentityScript();

        if (cancelled || !window.google?.accounts?.id) {
          return;
        }

        slotElement.innerHTML = "";

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
          context: mode === "signup" ? "signup" : "signin",
          callback: async (googleResponse) => {
            if (!googleResponse?.credential) {
              onErrorRef.current?.("Google sign-in did not return a usable credential.");
              return;
            }

            try {
              setStatus("authenticating");
              const response = await API.post("auth/google/", {
                credential: googleResponse.credential,
              });
              onSuccessRef.current?.(response.data);
              if (!cancelled) {
                setStatus("ready");
              }
            } catch (error) {
              if (!cancelled) {
                setStatus("ready");
              }
              onErrorRef.current?.(extractGoogleAuthError(error));
            }
          },
        });

        window.google.accounts.id.renderButton(slotElement, {
          type: "standard",
          shape: "pill",
          theme: themeMode === "dark" ? "filled_black" : "outline",
          size: "large",
          text: mode === "signup" ? "signup_with" : "continue_with",
          logo_alignment: "left",
          width: String(Math.max(240, Math.min(wrapperElement.offsetWidth || 360, 420))),
        });

        if (!cancelled) {
          setStatus("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
        }
      }
    };

    void initializeGoogleButton();

    return () => {
      cancelled = true;
      slotElement.innerHTML = "";
    };
  }, [disabled, mode, themeMode]);

  return (
    <section className={`sv-google-auth-shell ${className}`.trim()}>
      <div className="sv-google-auth-copy">
        <p className="sv-eyebrow">Google</p>
        <h3 className="sv-google-auth-title">{title}</h3>
        {description ? <p className="sv-google-auth-description">{description}</p> : null}
      </div>

      <div
        ref={wrapperRef}
        className={`sv-google-auth-render ${status === "authenticating" ? "is-authenticating" : ""} ${
          disabled ? "is-disabled" : ""
        }`.trim()}
      >
        {status === "unavailable" || status === "error" || status === "disabled" ? (
          <button type="button" className="sv-google-auth-fallback" disabled>
            <GoogleMarkIcon />
            <span>Continue with Google</span>
          </button>
        ) : null}

        {(status === "loading" || status === "ready" || status === "authenticating") ? (
          <div ref={slotRef} className="sv-google-auth-slot" />
        ) : null}

        {status === "loading" ? <div className="sv-google-auth-placeholder">Loading Google sign-in...</div> : null}
        {status === "authenticating" ? <div className="sv-google-auth-overlay">Finishing Google sign-in...</div> : null}
      </div>

      <p className="sv-google-auth-note">
        {status === "unavailable"
          ? "Google sign-in is not configured yet. Add REACT_APP_GOOGLE_CLIENT_ID to enable it."
          : status === "disabled"
            ? "Google sign-in is temporarily unavailable while another auth step is running."
          : note}
      </p>
    </section>
  );
}
