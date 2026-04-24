import { useCallback, useEffect, useRef, useState } from "react";

import { refreshAccessToken } from "../api/axios";
import { getAuthToken } from "../auth/session";

const WS_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000/api/")
  .replace(/^http/i, (protocol) => (protocol.toLowerCase() === "https" ? "wss" : "ws"))
  .replace(/\/api\/?$/, "");

export default function useWebSocket(path, { onMessage, enabled = true } = {}) {
  const [status, setStatus] = useState("disconnected");
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTokenRefreshRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    clearReconnectTimer();

    if (!enabled || typeof window === "undefined" || typeof WebSocket !== "function") {
      setStatus("disconnected");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setStatus("disconnected");
      return;
    }

    const normalizedPath = String(path || "").replace(/^\/+/, "");
    const url = `${WS_BASE_URL}/${normalizedPath}?token=${encodeURIComponent(token)}`;

    try {
      setStatus("connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        reconnectTokenRefreshRef.current = false;
        setStatus("connected");
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          onMessageRef.current?.(payload);
        } catch {
          // Ignore malformed websocket payloads so the socket stays alive.
        }
      };

      ws.onclose = async (event) => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }

        if (isUnmountedRef.current) {
          return;
        }

        setStatus("disconnected");

        if (!enabled || event.code === 1000) {
          return;
        }

        if (event.code === 4001 && !reconnectTokenRefreshRef.current) {
          reconnectTokenRefreshRef.current = true;
          try {
            await refreshAccessToken();
            reconnectAttemptsRef.current = 0;
            connect();
            return;
          } catch {
            reconnectTokenRefreshRef.current = false;
          }
        }

        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = () => {
        setStatus("disconnected");
      };
    } catch {
      setStatus("disconnected");
    }
  }, [clearReconnectTimer, enabled, path]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.close(1000);
        wsRef.current = null;
      }
    };
  }, [clearReconnectTimer, connect]);

  const sendMessage = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  return { status, sendMessage };
}
