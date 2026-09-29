import type { LucideIcon } from "lucide-react";

export function MetricCard({ icon: Icon, label, tone = "blue", value }: { icon: LucideIcon; label: string; tone?: "blue" | "green" | "gold"; value: string | number }) {
  return (
    <div className="card metric">
      <span className={`status ${tone}`}>{label}</span>
      <strong>{value}</strong>
      <Icon size={22} aria-hidden="true" />
    </div>
  );
}
