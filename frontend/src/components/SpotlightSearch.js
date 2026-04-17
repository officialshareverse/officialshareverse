import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  BellIcon,
  ChatIcon,
  CompassIcon,
  HomeIcon,
  LayersIcon,
  PlusIcon,
  SearchIcon,
  SparkIcon,
  UserIcon,
  WalletIcon,
} from "./UiIcons";

const RECENT_STORAGE_KEY = "sv-spotlight-recent-v1";
const MAX_RECENT_ITEMS = 6;

function getRecentCommandIds() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(RECENT_STORAGE_KEY);
    const parsed = storedValue ? JSON.parse(storedValue) : [];
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch (error) {
    console.error("Failed to read recent spotlight commands:", error);
    return [];
  }
}

function getPlatformModifierLabel() {
  if (typeof window === "undefined") {
    return "Ctrl";
  }

  const platform = window.navigator.platform || window.navigator.userAgent || "";
  return /Mac|iPhone|iPad/i.test(platform) ? "Cmd" : "Ctrl";
}

function scoreCommandMatch(command, normalizedQuery) {
  if (!normalizedQuery) {
    return 0;
  }

  const label = command.label.toLowerCase();
  const description = command.description.toLowerCase();
  const keywords = command.keywords.toLowerCase();
  const category = command.category.toLowerCase();
  const combined = `${label} ${description} ${keywords} ${category}`;

  if (!combined.includes(normalizedQuery)) {
    const terms = normalizedQuery.split(/\s+/).filter(Boolean);
    if (!terms.every((term) => combined.includes(term))) {
      return 0;
    }
  }

  let score = 0;
  if (label.startsWith(normalizedQuery)) {
    score += 120;
  }
  if (label.includes(normalizedQuery)) {
    score += 80;
  }
  if (keywords.includes(normalizedQuery)) {
    score += 44;
  }
  if (description.includes(normalizedQuery)) {
    score += 24;
  }
  if (category.includes(normalizedQuery)) {
    score += 12;
  }

  normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .forEach((term) => {
      if (label.includes(term)) {
        score += 12;
      } else if (keywords.includes(term)) {
        score += 8;
      } else if (description.includes(term)) {
        score += 4;
      }
    });

  return score;
}

function buildCommands({ isAuth, themeMode, toggleTheme, navigate, closeSpotlight }) {
  const themeCommand = {
    id: "theme-toggle",
    label: themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode",
    description: "Change the app appearance without leaving this page.",
    category: "Appearance",
    keywords: "theme appearance color dark light mode",
    icon: SparkIcon,
    action: () => {
      toggleTheme();
      closeSpotlight();
    },
  };

  if (!isAuth) {
    return [
      {
        id: "landing",
        label: "Go to ShareVerse home",
        description: "See the landing page, highlights, and trust notes.",
        category: "Navigate",
        keywords: "landing home welcome public",
        icon: HomeIcon,
        action: () => {
          navigate("/");
          closeSpotlight();
        },
      },
      {
        id: "login",
        label: "Log in",
        description: "Open the sign-in flow and continue into your dashboard.",
        category: "Navigate",
        keywords: "signin auth account",
        icon: UserIcon,
        action: () => {
          navigate("/login");
          closeSpotlight();
        },
      },
      {
        id: "signup",
        label: "Create an account",
        description: "Start the signup flow and verify your number.",
        category: "Navigate",
        keywords: "signup register create account join",
        icon: PlusIcon,
        action: () => {
          navigate("/signup");
          closeSpotlight();
        },
      },
      {
        id: "faq",
        label: "Read the FAQ",
        description: "Open common answers about groups, payments, and trust.",
        category: "Help",
        keywords: "questions support help",
        icon: SparkIcon,
        action: () => {
          navigate("/faq");
          closeSpotlight();
        },
      },
      {
        id: "support",
        label: "Open support",
        description: "Get help, policies, and contact options.",
        category: "Help",
        keywords: "contact support policy help",
        icon: ChatIcon,
        action: () => {
          navigate("/support");
          closeSpotlight();
        },
      },
      themeCommand,
    ];
  }

  return [
    {
      id: "home",
      label: "Open Home",
      description: "Jump to your dashboard, quick actions, and recent activity.",
      category: "Navigate",
      keywords: "dashboard overview greeting stats",
      icon: HomeIcon,
      action: () => {
        navigate("/home");
        closeSpotlight();
      },
    },
    {
      id: "groups",
      label: "Explore splits",
      description: "Browse open groups, filters, and join-ready listings.",
      category: "Navigate",
      keywords: "groups marketplace explore browse search",
      icon: CompassIcon,
      action: () => {
        navigate("/groups");
        closeSpotlight();
      },
    },
    {
      id: "create",
      label: "Create a new split",
      description: "Start a fresh sharing or buy-together flow.",
      category: "Quick action",
      keywords: "new split create publish host group",
      icon: PlusIcon,
      action: () => {
        navigate("/create");
        closeSpotlight();
      },
    },
    {
      id: "my-shared",
      label: "Open My Splits",
      description: "Check members, updates, confirmations, and next actions.",
      category: "Navigate",
      keywords: "my groups hosted joined manage members",
      icon: LayersIcon,
      action: () => {
        navigate("/my-shared");
        closeSpotlight();
      },
    },
    {
      id: "wallet",
      label: "Open Wallet",
      description: "Top up, review transactions, and request withdrawals.",
      category: "Quick action",
      keywords: "money topup withdraw payments balance",
      icon: WalletIcon,
      action: () => {
        navigate("/wallet");
        closeSpotlight();
      },
    },
    {
      id: "notifications",
      label: "Check notifications",
      description: "Review group, wallet, and system updates in one place.",
      category: "Inbox",
      keywords: "alerts updates inbox system wallet groups",
      icon: BellIcon,
      action: () => {
        navigate("/notifications");
        closeSpotlight();
      },
    },
    {
      id: "chats",
      label: "Open chats",
      description: "Jump into your latest conversations and unread threads.",
      category: "Inbox",
      keywords: "messages inbox chat group conversations",
      icon: ChatIcon,
      action: () => {
        navigate("/chats");
        closeSpotlight();
      },
    },
    {
      id: "profile",
      label: "View profile",
      description: "Manage your account, trust score, and public details.",
      category: "Navigate",
      keywords: "account user profile trust settings",
      icon: UserIcon,
      action: () => {
        navigate("/profile");
        closeSpotlight();
      },
    },
    {
      id: "support",
      label: "Open support",
      description: "Get help, policies, and contact options.",
      category: "Help",
      keywords: "support contact faq help",
      icon: SparkIcon,
      action: () => {
        navigate("/support");
        closeSpotlight();
      },
    },
    themeCommand,
  ];
}

export default function SpotlightSearch({ isAuth, isOpen, onOpen, onClose, themeMode, toggleTheme }) {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef(null);
  const resultRefs = useRef({});
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentCommandIds, setRecentCommandIds] = useState(getRecentCommandIds);
  const modifierLabel = useMemo(() => getPlatformModifierLabel(), []);

  const commands = useMemo(
    () =>
      buildCommands({
        isAuth,
        themeMode,
        toggleTheme,
        navigate,
        closeSpotlight: onClose,
      }),
    [isAuth, navigate, onClose, themeMode, toggleTheme]
  );

  const commandMap = useMemo(() => new Map(commands.map((command) => [command.id, command])), [commands]);

  const recentCommands = useMemo(
    () => recentCommandIds.map((id) => commandMap.get(id)).filter(Boolean),
    [commandMap, recentCommandIds]
  );

  const suggestedCommands = useMemo(() => {
    const preferredIds = isAuth
      ? ["create", "groups", "wallet", "notifications", "chats", "theme-toggle"]
      : ["login", "signup", "faq", "support", "theme-toggle"];

    return preferredIds
      .map((id) => commandMap.get(id))
      .filter(Boolean)
      .filter((command) => !recentCommandIds.includes(command.id));
  }, [commandMap, isAuth, recentCommandIds]);

  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    return commands
      .map((command) => ({ command, score: scoreCommandMatch(command, normalizedQuery) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.command.label.localeCompare(right.command.label))
      .map((item) => item.command);
  }, [commands, query]);

  const sections = useMemo(() => {
    if (query.trim()) {
      return filteredCommands.length ? [{ id: "matches", title: "Matches", items: filteredCommands }] : [];
    }

    const nextSections = [];
    if (recentCommands.length) {
      nextSections.push({ id: "recent", title: "Recent", items: recentCommands });
    }
    if (suggestedCommands.length) {
      nextSections.push({
        id: recentCommands.length ? "suggested" : "start-here",
        title: recentCommands.length ? "Suggested" : "Start here",
        items: suggestedCommands,
      });
    }
    return nextSections;
  }, [filteredCommands, query, recentCommands, suggestedCommands]);

  const flatResults = useMemo(() => sections.flatMap((section) => section.items), [sections]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentCommandIds));
    } catch (error) {
      console.error("Failed to store recent spotlight commands:", error);
    }
  }, [recentCommandIds]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    document.body.classList.add("sv-spotlight-open");
    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 20);

    return () => {
      document.body.classList.remove("sv-spotlight-open");
      window.clearTimeout(timeoutId);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setQuery("");
    setActiveIndex(0);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      onClose();
    }
  }, [location.pathname, isOpen, onClose]);

  useEffect(() => {
    if (!flatResults.length) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex((current) => Math.min(current, flatResults.length - 1));
  }, [flatResults.length]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const activeCommand = flatResults[activeIndex];
    if (!activeCommand) {
      return;
    }

    resultRefs.current[activeCommand.id]?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeIndex, flatResults, isOpen]);

  const selectCommand = useCallback((command) => {
    setRecentCommandIds((current) => [command.id, ...current.filter((value) => value !== command.id)].slice(0, MAX_RECENT_ITEMS));
    command.action();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isSpotlightShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";

      if (isSpotlightShortcut) {
        event.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          onOpen();
        }
        return;
      }

      if (!isOpen) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (!flatResults.length) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % flatResults.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + flatResults.length) % flatResults.length);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        selectCommand(flatResults[activeIndex] || flatResults[0]);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeIndex, flatResults, isOpen, onClose, onOpen, selectCommand]);

  if (!isOpen) {
    return null;
  }

  let visibleIndex = -1;

  return (
    <div className="sv-spotlight-shell" role="dialog" aria-modal="true" aria-labelledby="sv-spotlight-title">
      <button type="button" className="sv-spotlight-backdrop" onClick={onClose} aria-label="Close search" />

      <div className="sv-spotlight-panel sv-page-enter">
        <div className="sv-spotlight-header">
          <div className="min-w-0">
            <p className="sv-eyebrow">Spotlight</p>
            <h2 id="sv-spotlight-title" className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">
              Jump anywhere
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Search pages, quick actions, and settings without leaving your flow.
            </p>
          </div>

          <div className="sv-spotlight-shortcuts" aria-hidden="true">
            <span className="sv-spotlight-kbd">{modifierLabel}</span>
            <span className="sv-spotlight-kbd">K</span>
          </div>
        </div>

        <div className="sv-spotlight-input-shell">
          <span className="sv-spotlight-input-icon">
            <SearchIcon className="h-5 w-5" />
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="sv-spotlight-input"
            placeholder={isAuth ? "Search Home, Wallet, Create, Notifications..." : "Search login, signup, FAQ, support..."}
            aria-label="Search commands"
          />
          <button type="button" onClick={onClose} className="sv-spotlight-dismiss sv-focus-ring">
            Esc
          </button>
        </div>

        <div className="sv-spotlight-meta">
          <span>{query.trim() ? `${flatResults.length} match${flatResults.length === 1 ? "" : "es"}` : "Use arrow keys to move, then press Enter."}</span>
          <span className="sv-spotlight-meta-keys" aria-hidden="true">
            <span className="sv-spotlight-kbd">Up</span>
            <span className="sv-spotlight-kbd">Down</span>
            <span className="sv-spotlight-kbd">Enter</span>
          </span>
        </div>

        <div className="sv-spotlight-results">
          {sections.length ? (
            sections.map((section) => (
              <section key={section.id} className="sv-spotlight-section">
                <p className="sv-spotlight-section-label">{section.title}</p>
                <div className="sv-stagger-grid">
                  {section.items.map((command) => {
                    visibleIndex += 1;
                    const resultIndex = visibleIndex;
                    const Icon = command.icon;
                    const isActive = resultIndex === activeIndex;
                    const isCurrentPage =
                      (command.id === "home" && location.pathname === "/home") ||
                      (command.id === "groups" && location.pathname.startsWith("/groups")) ||
                      (command.id === "create" && location.pathname.startsWith("/create")) ||
                      (command.id === "my-shared" && location.pathname.startsWith("/my-shared")) ||
                      (command.id === "wallet" && location.pathname.startsWith("/wallet")) ||
                      (command.id === "notifications" && location.pathname.startsWith("/notifications")) ||
                      (command.id === "chats" && (location.pathname.startsWith("/chats") || /^\/groups\/[^/]+\/chat/.test(location.pathname))) ||
                      (command.id === "profile" && location.pathname.startsWith("/profile"));

                    return (
                      <button
                        key={command.id}
                        type="button"
                        ref={(node) => {
                          resultRefs.current[command.id] = node;
                        }}
                        onClick={() => selectCommand(command)}
                        onMouseEnter={() => setActiveIndex(resultIndex)}
                        className={`sv-spotlight-result sv-focus-ring ${isActive ? "is-active" : ""}`}
                      >
                        <span className="sv-spotlight-result-icon">
                          <Icon className="h-5 w-5" />
                        </span>

                        <span className="min-w-0">
                          <span className="sv-spotlight-result-topline">
                            <span className="sv-spotlight-result-label">{command.label}</span>
                            {isCurrentPage ? <span className="sv-spotlight-result-chip">Current</span> : null}
                          </span>
                          <span className="sv-spotlight-result-description">{command.description}</span>
                        </span>

                        <span className="sv-spotlight-result-side">
                          <span className="sv-spotlight-result-category">{command.category}</span>
                          <span className="sv-spotlight-result-enter">Enter</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          ) : (
            <div className="sv-spotlight-empty">
              <span className="sv-spotlight-empty-icon">
                <SearchIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-base font-bold text-slate-950">No matches yet</p>
                <p className="mt-1 text-sm text-slate-500">
                  Try searching for pages like Home, Wallet, Create, or Support.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
