import type { CheckResult, InspectionCheck, RentalModule } from "./types";

export const today = "2026-05-17";

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function daysBetween(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00`).getTime();
  const end = new Date(`${endDate}T12:00:00`).getTime();
  return Math.max(1, Math.ceil((end - start) / 86400000));
}

export function daysUntil(date: string) {
  const target = new Date(`${date}T12:00:00`).getTime();
  const current = new Date(`${today}T12:00:00`).getTime();
  return Math.ceil((target - current) / 86400000);
}

export function dueLabel(date: string) {
  const days = daysUntil(date);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "due today";
  return `${days}d left`;
}

export function healthClass(score: number) {
  if (score >= 94) return "good";
  if (score >= 86) return "watch";
  return "bad";
}

export function resultClass(result: CheckResult) {
  if (result === "pass") return "good";
  if (result === "watch") return "watch";
  return "bad";
}

export function moduleLabel(module: RentalModule) {
  return module === "vehicles" ? "Vehicles" : "Properties";
}

export function buildChecks(labels: string[]): InspectionCheck[] {
  return labels.map((label, index) => ({
    id: uid(`check-${index}`),
    label,
    result: "pass",
    notes: "",
  }));
}
