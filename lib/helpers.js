export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function fmt(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function monthRange(dateStr) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = new Date(y, m, 1).toISOString().slice(0, 10);
  const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

export function fyRange(dateStr) {
  const d = new Date(dateStr);
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; // FY starts April
  return {
    start: `${y}-04-01`,
    end: `${y + 1}-03-31`,
    label: `FY ${y}-${String(y + 1).slice(2)}`,
  };
}

// Returns the last `count` financial years (most recent first), each as
// { start, end, label } — same shape as fyRange().
export function listRecentFYs(count = 5) {
  const current = fyRange(todayStr());
  const currentStartYear = Number(current.start.slice(0, 4));
  const out = [];
  for (let i = 0; i < count; i++) {
    const y = currentStartYear - i;
    out.push({
      start: `${y}-04-01`,
      end: `${y + 1}-03-31`,
      label: `FY ${y}-${String(y + 1).slice(2)}`,
    });
  }
  return out;
}

export function itemLabel(item) {
  if (!item) return "—";
  return `${item.name}${item.size ? " · " + item.size : ""} (${item.category})`;
}

export const EXPENSE_TYPES = ["Salary", "Rent", "Dealer Payment", "Sadar", "Sadar Daily"];
