import { ChangeChip } from "./ChangeChip";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  icon?: React.ReactNode;
  size?: "sm" | "lg";
}

export function KpiCard({ label, value, delta, deltaLabel, icon, size = "lg" }: KpiCardProps) {
  return (
    <div
      className="cf-card p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-medium uppercase tracking-widest"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {label}
        </span>
        {icon && (
          <span style={{ color: "var(--color-text-muted)" }}>{icon}</span>
        )}
      </div>

      <div className="flex items-end justify-between gap-2">
        <span
          className={`font-bold tabular-nums ${size === "lg" ? "text-3xl" : "text-xl"}`}
          style={{ color: "var(--color-text-primary)" }}
        >
          {value}
        </span>
        {delta !== undefined && (
          <div className="flex flex-col items-end gap-0.5 pb-0.5">
            <ChangeChip value={delta} size="sm" />
            {deltaLabel && (
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {deltaLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
