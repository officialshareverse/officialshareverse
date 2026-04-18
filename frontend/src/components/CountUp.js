import { useEffect, useRef, useState } from "react";

function defaultFormatter(value, format, decimals) {
  const numericValue = Number(value || 0);

  if (format === "currency") {
    return `Rs ${numericValue.toFixed(decimals ?? 2)}`;
  }

  return numericValue.toLocaleString("en-IN", {
    maximumFractionDigits: decimals ?? 0,
    minimumFractionDigits: decimals ?? 0,
  });
}

export default function CountUp({
  value = 0,
  format = "number",
  decimals,
  duration = 650,
  formatter,
  className = "",
}) {
  const targetValue = Number(value || 0);
  const previousValueRef = useRef(targetValue);
  const [displayValue, setDisplayValue] = useState(targetValue);

  useEffect(() => {
    const from = previousValueRef.current;
    const to = targetValue;

    if (Number.isNaN(to) || from === to) {
      previousValueRef.current = to;
      setDisplayValue(to);
      return undefined;
    }

    let animationFrameId = 0;
    const startedAt = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplayValue(from + (to - from) * eased);
      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(tick);
      }
    };

    animationFrameId = window.requestAnimationFrame(tick);
    previousValueRef.current = to;
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [duration, targetValue]);

  return (
    <span className={className}>
      {formatter
        ? formatter(displayValue)
        : defaultFormatter(displayValue, format, decimals)}
    </span>
  );
}
