import { useCallback, useMemo, useRef, useState } from "react";

export default function usePullToRefresh({
  onRefresh,
  disabled = false,
  threshold = 76,
  maxPull = 116,
}) {
  const startYRef = useRef(null);
  const isActiveRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const reset = useCallback(() => {
    startYRef.current = null;
    isActiveRef.current = false;
    setPullDistance(0);
  }, []);

  const handleTouchStart = useCallback(
    (event) => {
      if (disabled || isRefreshingRef.current || event.touches.length !== 1) {
        return;
      }

      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      if (scrollTop > 0) {
        return;
      }

      startYRef.current = event.touches[0].clientY;
      isActiveRef.current = false;
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (event) => {
      if (disabled || isRefreshingRef.current || startYRef.current === null) {
        return;
      }

      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      if (scrollTop > 0) {
        reset();
        return;
      }

      const deltaY = event.touches[0].clientY - startYRef.current;
      if (deltaY <= 0) {
        return;
      }

      const nextDistance = Math.min(maxPull, deltaY * 0.82);
      if (nextDistance <= 0) {
        return;
      }

      isActiveRef.current = true;
      setPullDistance(nextDistance);

      if (event.cancelable) {
        event.preventDefault();
      }
    },
    [disabled, maxPull, reset]
  );

  const finishRefresh = useCallback(async () => {
    if (isRefreshingRef.current) {
      return;
    }

    isRefreshingRef.current = true;
    setIsRefreshing(true);
    setPullDistance(Math.min(maxPull, threshold));

    try {
      await Promise.resolve(onRefresh?.());
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      reset();
    }
  }, [maxPull, onRefresh, reset, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (disabled) {
      reset();
      return;
    }

    if (!isActiveRef.current) {
      reset();
      return;
    }

    if (pullDistance >= threshold) {
      await finishRefresh();
      return;
    }

    reset();
  }, [disabled, finishRefresh, pullDistance, reset, threshold]);

  const bind = useMemo(
    () => ({
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: reset,
    }),
    [handleTouchEnd, handleTouchMove, handleTouchStart, reset]
  );

  return {
    bind,
    isRefreshing,
    isPulling: pullDistance > 0,
    progress: Math.max(0, Math.min(1, pullDistance / threshold)),
  };
}
