import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ChangeChipProps {
  value: number;
  suffix?: string;
  size?: "sm" | "md";
}

export function ChangeChip({ value, suffix = "%", size = "md" }: ChangeChipProps) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  const styles = isNeutral
    ? { color: "var(--color-text-secondary)", background: "var(--color-bg-elevated)" }
    : isPositive
    ? { color: "var(--color-gain)", background: "var(--color-gain-subtle)" }
    : { color: "var(--color-loss)", background: "var(--color-loss-subtle)" };

  const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium tabular-nums ${textSize}`}
      style={styles}
    >
      <Icon size={12} />
      {isPositive && "+"}
      {value.toFixed(2)}
      {suffix}
    </span>
  );
}
