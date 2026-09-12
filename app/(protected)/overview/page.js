"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fmt, todayStr, monthRange, fyRange, listRecentFYs, itemLabel } from "@/lib/helpers";

const FY_OPTIONS = listRecentFYs(6);
const PERIODS = [
  { key: "today", label: "Today" },
  { key: "month", label: "This month" },
  { key: "fy", label: "Financial year" },
];

function Kpi({ label, value, tone, sub }) {
  const toneClass = tone === "pos" ? "text-bottle" : tone === "neg" ? "text-red" : "text-ink";
  return (
    <div className="kpi">
      <div className="text-[11px] uppercase tracking-wide text-stone-500 font-semibold truncate">
        {label}
      </div>
      <div className={`font-display font-semibold text-xl mt-1 ${toneClass}`}>{value}</div>
      {sub && <div className="text-[11px] text-stone-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function OverviewPage() {
  const [period, setPeriod] = useState("month");
  const [fyIdx, setFyIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  const [revenue, setRevenue] = useState(0);
  const [cogs, setCogs] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [expenseByType, setExpenseByType] = useState([]);
  const [categoryPerf, setCategoryPerf] = useState([]);
  const [topItems, setTopItems] = useState([]);

  const [stockValue, setStockValue] = useState(0);
  const [dealerPayableTotal, setDealerPayableTotal] = useState(0);
  const [salaryDueTotal, setSalaryDueTotal] = useState(0);

  const range =
    period === "today"
      ? { start: todayStr(), end: todayStr(), label: "Today" }
      : period === "month"
      ? { ...monthRange(todayStr()), label: "This month" }
      : { start: FY_OPTIONS[fyIdx].start, end: FY_OPTIONS[fyIdx].end, label: FY_OPTIONS[fyIdx].label };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, fyIdx]);

  useEffect(() => {
    loadSnapshot();
  }, []);

  async function loadSnapshot() {
    const [{ data: items }, { data: ledger }, { data: emp }] = await Promise.all([
      supabase.from("inventory_items").select("stock, purchase_rate"),
      supabase.from("dealer_ledger").select("balance_due").gt("balance_due", 0),
      supabase.from("employee_ledger").select("outstanding").gt("outstanding", 0),
    ]);
    setStockValue((items || []).reduce((s, i) => s + Number(i.stock) * Number(i.purchase_rate), 0));
    setDealerPayableTotal((ledger || []).reduce((s, d) => s + Number(d.balance_due), 0));
    setSalaryDueTotal((emp || []).reduce((s, e) => s + Number(e.outstanding), 0));
  }

  async function load() {
    setLoading(true);
    const { start, end } = range;

    const { data: days } = await supabase
      .from("sale_days")
      .select("id")
      .gte("sale_date", start)
      .lte("sale_date", end);
    const dayIds = (days || []).map((d) => d.id);

    let lines = [];
    if (dayIds.length) {
      const { data } = await supabase
        .from("sale_lines")
        .select("qty, value, inventory_items(name, size, category, purchase_rate)")
        .in("sale_day_id", dayIds);
      lines = data || [];
    }

    const rev = lines.reduce((s, l) => s + Number(l.value), 0);
    const cost = lines.reduce(
      (s, l) => s + Number(l.qty) * Number(l.inventory_items?.purchase_rate || 0),
      0
    );
    setRevenue(rev);
    setCogs(cost);

    const catMap = {};
    lines.forEach((l) => {
      const cat = l.inventory_items?.category || "Other";
      if (!catMap[cat]) catMap[cat] = { qty: 0, value: 0 };
      catMap[cat].qty += Number(l.qty);
      catMap[cat].value += Number(l.value);
    });
    const catRows = Object.entries(catMap)
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.value - a.value);
    setCategoryPerf(catRows);

    const itemMap = {};
    lines.forEach((l) => {
      const key = itemLabel(l.inventory_items);
      if (!itemMap[key]) itemMap[key] = { qty: 0, value: 0 };
      itemMap[key].qty += Number(l.qty);
      itemMap[key].value += Number(l.value);
    });
    const itemRows = Object.entries(itemMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    setTopItems(itemRows);

    const { data: exp } = await supabase
      .from("expenses")
      .select("amount, type")
      .neq("type", "Dealer Payment") // settling a purchase debt isn't a P&L expense — it's already counted via COGS
      .gte("expense_date", start)
      .lte("expense_date", end);
    const expTotal = (exp || []).reduce((s, x) => s + Number(x.amount), 0);
    setExpenseTotal(expTotal);

    const typeMap = {};
    (exp || []).forEach((x) => {
      typeMap[x.type] = (typeMap[x.type] || 0) + Number(x.amount);
    });
    setExpenseByType(
      Object.entries(typeMap)
        .map(([type, amount]) => ({ type, amount }))
        .sort((a, b) => b.amount - a.amount)
    );

    setLoading(false);
  }

  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - expenseTotal;

  return (
    <div>
      <div className="card">
        <div className="flex justify-between items-center flex-wrap gap-3 mb-1">
          <h2 className="font-display font-semibold text-lg">Business overview</h2>
          <div className="flex gap-2 items-end flex-wrap">
            <select className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIODS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
            {period === "fy" && (
              <select className="input" value={fyIdx} onChange={(e) => setFyIdx(Number(e.target.value))}>
                {FY_OPTIONS.map((f, i) => (
                  <option key={f.label} value={i}>
                    {f.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <p className="text-xs text-stone-500 mb-4">
          Cost of goods sold uses each item's current purchase rate (historical rate changes
          aren't tracked per sale). Dealer payments are excluded from expenses below since
          they're already reflected in cost of goods when that stock was sold.
        </p>

        {loading ? (
          <div className="text-sm text-stone-500">Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-2">
              <Kpi label="Revenue" value={fmt(revenue)} />
              <Kpi label="Cost of goods" value={fmt(cogs)} />
              <Kpi label="Gross profit" value={fmt(grossProfit)} tone={grossProfit >= 0 ? "pos" : "neg"} />
              <Kpi label="Operating expenses" value={fmt(expenseTotal)} />
              <Kpi
                label="Net profit"
                value={fmt(netProfit)}
                tone={netProfit >= 0 ? "pos" : "neg"}
                sub={range.label}
              />
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div className="card">
          <h2 className="font-display font-semibold text-lg mb-3">Sales by category</h2>
          <div className="overflow-x-auto">
            <table className="data">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="text-right">Qty sold</th>
                  <th className="text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {categoryPerf.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-stone-400 italic text-sm py-3">
                      No sales in this period.
                    </td>
                  </tr>
                ) : (
                  categoryPerf.map((c) => (
                    <tr key={c.category}>
                      <td>{c.category}</td>
                      <td className="text-right font-mono">{c.qty}</td>
                      <td className="text-right font-mono">{fmt(c.value)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="font-display font-semibold text-lg mb-3">Top sellers</h2>
          <div className="overflow-x-auto">
            <table className="data">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Qty sold</th>
                  <th className="text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topItems.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-stone-400 italic text-sm py-3">
                      No sales in this period.
                    </td>
                  </tr>
                ) : (
                  topItems.map((i) => (
                    <tr key={i.name}>
                      <td>{i.name}</td>
                      <td className="text-right font-mono">{i.qty}</td>
                      <td className="text-right font-mono">{fmt(i.value)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-display font-semibold text-lg mb-3">Expenses by type</h2>
          <div className="overflow-x-auto">
            <table className="data">
              <thead>
                <tr>
                  <th>Type</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenseByType.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="text-stone-400 italic text-sm py-3">
                      No expenses in this period.
                    </td>
                  </tr>
                ) : (
                  expenseByType.map((e) => (
                    <tr key={e.type}>
                      <td>{e.type}</td>
                      <td className="text-right font-mono">{fmt(e.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="font-display font-semibold text-lg mb-3">
            Business snapshot <span className="text-xs font-normal text-stone-500">(as of today)</span>
          </h2>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex justify-between items-center border-b border-line py-2">
              <span className="text-sm text-stone-600">Inventory stock value</span>
              <span className="font-mono font-semibold">{fmt(stockValue)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-line py-2">
              <span className="text-sm text-stone-600">Owed to dealers</span>
              <span className="font-mono font-semibold text-red">{fmt(dealerPayableTotal)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-stone-600">Salary due (this month)</span>
              <span className="font-mono font-semibold text-red">{fmt(salaryDueTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
