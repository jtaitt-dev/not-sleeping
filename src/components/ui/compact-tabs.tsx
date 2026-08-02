import "./compact-tabs.css";

export type TabItem = {
  value: string;
  label: string;
};

export function CompactTabs({
  items,
  value,
  onValueChange,
  label,
}: {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="compact-tabs" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          type="button"
          role="tab"
          aria-selected={item.value === value}
          className="compact-tab"
          data-state={item.value === value ? "active" : "inactive"}
          key={item.value}
          onClick={() => onValueChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
