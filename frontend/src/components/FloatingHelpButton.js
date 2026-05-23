import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const PAGE_TIPS = {
  "/home": "Your command center — see wallet balance, active groups, and what needs attention.",
  "/groups": "Browse live groups, filter by type, and join with one click using your wallet.",
  "/create": "Open paid spots on a plan you manage, or start a buy-together group.",
  "/my-shared": "Manage splits you host and track the ones you joined, all in one place.",
  "/wallet": "Add money to join groups, set up a payout method, and withdraw anytime.",
  "/notifications": "Updates from groups you host or joined — confirmations, new members, and more.",
  "/chats": "Group conversations stay here so context never gets lost.",
  "/profile": "Complete your profile to build trust with hosts and members.",
  "/referrals": "Invite friends and earn wallet credit when they join ShareVerse.",
};

export default function FloatingHelpButton() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef(null);

  const currentPath = location.pathname;
  const currentTip = PAGE_TIPS[currentPath] || PAGE_TIPS["/home"];

  const toggle = useCallback(() => {
    setIsOpen((current) => !current);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    close();
  }, [close, currentPath]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        close();
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        close();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [close, isOpen]);

  const reopenGuide = () => {
    close();

    const userId = (() => {
      try {
        const keys = Object.keys(window.localStorage);
        const introKey = keys.find((key) => key.startsWith("sv-home-intro-seen-"));
        if (introKey) {
          window.localStorage.removeItem(introKey);
        }
        const guideKey = keys.find((key) => key.startsWith("sv-home-guide-seen-"));
        if (guideKey) {
          window.localStorage.removeItem(guideKey);
        }
      } catch {
        // Ignore storage failures.
      }
    })();

    void userId;
    navigate("/home");
  };

  return (
    <div className="sv-floating-help" ref={menuRef}>
      {isOpen ? (
        <div className="sv-floating-help-menu sv-animate-rise">
          <div className="sv-floating-help-tip">
            <p className="sv-floating-help-tip-label">This page</p>
            <p className="sv-floating-help-tip-body">{currentTip}</p>
          </div>

          <div className="sv-floating-help-links">
            <button type="button" onClick={reopenGuide} className="sv-floating-help-link">
              <span className="sv-floating-help-link-icon" aria-hidden="true">📖</span>
              Re-open onboarding guide
            </button>
            <button
              type="button"
              onClick={() => { close(); navigate("/faq"); }}
              className="sv-floating-help-link"
            >
              <span className="sv-floating-help-link-icon" aria-hidden="true">❓</span>
              Frequently asked questions
            </button>
            <button
              type="button"
              onClick={() => { close(); navigate("/support"); }}
              className="sv-floating-help-link"
            >
              <span className="sv-floating-help-link-icon" aria-hidden="true">💬</span>
              Contact support
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={toggle}
        className={`sv-floating-help-trigger ${isOpen ? "is-open" : ""}`}
        aria-label="Help and tips"
        aria-expanded={isOpen}
      >
        <span aria-hidden="true">{isOpen ? "✕" : "?"}</span>
      </button>
    </div>
  );
}
