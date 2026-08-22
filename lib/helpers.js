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

export function itemLabel(item) {
  if (!item) return "—";
  return `${item.name}${item.size ? " · " + item.size : ""} (${item.category})`;
}
