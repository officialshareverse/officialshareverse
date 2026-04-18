export default function Tabs({
  tabs,
  value,
  onChange,
  className = "",
  tabClassName = "",
}) {
  return (
    <div className={`sv-tabs ${className}`.trim()}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`sv-tab ${value === tab.value ? "is-active" : ""} ${tabClassName} ${tab.className || ""}`.trim()}
        >
          <span>{tab.label}</span>
          {typeof tab.count === "number" ? <span className="sv-tab-count">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
