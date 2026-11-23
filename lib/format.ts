export function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatMoney(n: number) {
  return money.format(Number.isFinite(n) ? n : 0);
}

/** Per-person share rounded to cents. Returns 0 for invalid input. */
export function perPerson(total: number, people: number) {
  if (!Number.isFinite(total) || !Number.isFinite(people) || people < 1) return 0;
  return Math.round((total / people) * 100) / 100;
}

export function formatEventDate(iso: string, allDay: boolean) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (allDay) return date;
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

export function formatClock(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
