"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fmt, todayStr, monthRange, fyRange, itemLabel } from "@/lib/helpers";

function Kpi({ label, value, tone }) {
  const toneClass = tone === "pos" ? "text-bottle" : tone === "neg" ? "text-red" : "text-ink";
  return (
    <div className="kpi">
      <div className="text-[11px] uppercase tracking-wide text-stone-500 font-semibold truncate">
        {label}
      </div>
      <div className={`kpi-value mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}

async function salesValueInRange(start, end) {
  const { data, error } = await supabase
    .from("sale_days")
    .select("cash, upi, sale_lines(value)")
    .gte("sale_date", start)
    .lte("sale_date", end);
  if (error || !data) return 0;
  return data.reduce(
    (sum, day) => sum + (day.sale_lines || []).reduce((s, l) => s + Number(l.value), 0),
    0
  );
}

async function expensesInRange(start, end) {
  const { data, error } = await supabase
    .from("expenses")
    .select("amount")
    .gte("expense_date", start)
    .lte("expense_date", end);
  if (error || !data) return 0;
  return data.reduce((s, x) => s + Number(x.amount), 0);
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState({ sale: 0, expense: 0 });
  const [month, setMonth] = useState({ sale: 0, expense: 0 });
  const [fy, setFy] = useState({ sale: 0, expense: 0, label: "" });
  const [lowStock, setLowStock] = useState([]);
  const [payables, setPayables] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const t = todayStr();
    const { start: ms, end: me } = monthRange(t);
    const fyr = fyRange(t);

    const [todaySale, todayExpense, monthSale, monthExpense, fySale, fyExpense] =
      await Promise.all([
        salesValueInRange(t, t),
        expensesInRange(t, t),
        salesValueInRange(ms, me),
        expensesInRange(ms, me),
        salesValueInRange(fyr.start, fyr.end),
        expensesInRange(fyr.start, fyr.end),
      ]);

    setToday({ sale: todaySale, expense: todayExpense });
    setMonth({ sale: monthSale, expense: monthExpense });
    setFy({ sale: fySale, expense: fyExpense, label: fyr.label });

    const { data: low } = await supabase.from("low_stock").select("*");
    setLowStock(low || []);

    const { data: ledger } = await supabase
      .from("dealer_ledger")
      .select("*")
      .gt("balance_due", 0)
      .order("balance_due", { ascending: false });
    setPayables(ledger || []);

    setLoading(false);
  }

  if (loading) return <div className="text-sm text-stone-500">Loading dashboard…</div>;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <Kpi label="Today's sale" value={fmt(today.sale)} />
        <Kpi label="Today's expense" value={fmt(today.expense)} />
        <Kpi
          label="Today's net"
          value={fmt(today.sale - today.expense)}
          tone={today.sale - today.expense >= 0 ? "pos" : "neg"}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div className="card">
          <h2 className="font-display font-semibold text-lg mb-3">This month</h2>
          <div className="grid grid-cols-3 gap-2 min-w-0">
            <Kpi label="Sales" value={fmt(month.sale)} />
            <Kpi label="Expenses" value={fmt(month.expense)} />
            <Kpi
              label="Net"
              value={fmt(month.sale - month.expense)}
              tone={month.sale - month.expense >= 0 ? "pos" : "neg"}
            />
          </div>
        </div>
        <div className="card">
          <h2 className="font-display font-semibold text-lg mb-3">
            Financial year <span className="text-xs font-normal text-stone-500">({fy.label})</span>
          </h2>
          <div className="grid grid-cols-3 gap-2 min-w-0">
            <Kpi label="Sales" value={fmt(fy.sale)} />
            <Kpi label="Expenses" value={fmt(fy.expense)} />
            <Kpi
              label="Net"
              value={fmt(fy.sale - fy.expense)}
              tone={fy.sale - fy.expense >= 0 ? "pos" : "neg"}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-display font-semibold text-lg">Low stock alert</h2>
            <span className="text-xs text-stone-500">below 10 units</span>
          </div>
          <table className="data">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th className="text-right">Stock</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-stone-400 italic text-sm py-3">
                    Nothing below threshold.
                  </td>
                </tr>
              ) : (
                lowStock.map((i) => (
                  <tr key={i.id}>
                    <td>{itemLabel(i)}</td>
                    <td>{i.category}</td>
                    <td className="text-right font-mono text-red font-semibold">{i.stock}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="font-display font-semibold text-lg mb-2">Dealer payables</h2>
          <table className="data">
            <thead>
              <tr>
                <th>Dealer</th>
                <th className="text-right">Balance due</th>
              </tr>
            </thead>
            <tbody>
              {payables.length === 0 ? (
                <tr>
                  <td colSpan={2} className="text-stone-400 italic text-sm py-3">
                    All dealers settled.
                  </td>
                </tr>
              ) : (
                payables.map((d) => (
                  <tr key={d.dealer_id}>
                    <td>{d.name}</td>
                    <td className="text-right font-mono">{fmt(d.balance_due)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
