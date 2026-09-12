"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fmt, todayStr, listRecentFYs, itemLabel, EXPENSE_TYPES } from "@/lib/helpers";

const FY_OPTIONS = listRecentFYs(6);

function monthsInRange(fyStart, fyEnd) {
  const today = todayStr();
  const cap = fyEnd < today ? fyEnd : today;
  const out = [];
  let d = new Date(fyStart);
  const capDate = new Date(cap);
  while (d <= capDate) {
    out.push(d.toISOString().slice(0, 10));
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  return out;
}

function toRunningBalance(openingBalance, txns) {
  let bal = openingBalance;
  return txns.map((t) => {
    bal += t.debit - t.credit;
    return { ...t, balance: bal };
  });
}

async function buildDealerLedger(dealer, fy) {
  const [{ data: priorPurchases }, { data: priorPayments }, { data: purchases }, { data: payments }] =
    await Promise.all([
      supabase.from("purchases").select("value").eq("dealer_id", dealer.id).lt("purchase_date", fy.start),
      supabase
        .from("expenses")
        .select("amount")
        .eq("dealer_id", dealer.id)
        .eq("type", "Dealer Payment")
        .lt("expense_date", fy.start),
      supabase
        .from("purchases")
        .select("purchase_date, value, qty, rate, inventory_items(name, size, category)")
        .eq("dealer_id", dealer.id)
        .gte("purchase_date", fy.start)
        .lte("purchase_date", fy.end)
        .order("purchase_date"),
      supabase
        .from("expenses")
        .select("expense_date, amount, note")
        .eq("dealer_id", dealer.id)
        .eq("type", "Dealer Payment")
        .gte("expense_date", fy.start)
        .lte("expense_date", fy.end)
        .order("expense_date"),
    ]);

  const openingPurchased = (priorPurchases || []).reduce((s, p) => s + Number(p.value), 0);
  const openingPaid = (priorPayments || []).reduce((s, p) => s + Number(p.amount), 0);
  const opening = openingPurchased - openingPaid;

  const txns = [
    ...(purchases || []).map((p) => ({
      date: p.purchase_date,
      type: "Purchase",
      detail: `${itemLabel(p.inventory_items)} — ${p.qty} @ ${fmt(p.rate)}`,
      debit: Number(p.value),
      credit: 0,
    })),
    ...(payments || []).map((p) => ({
      date: p.expense_date,
      type: "Payment",
      detail: p.note || "Dealer payment",
      debit: 0,
      credit: Number(p.amount),
    })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const rows = toRunningBalance(opening, txns);
  const closing = rows.length ? rows[rows.length - 1].balance : opening;
  return { opening, rows, closing, hasOpening: true, balanceLabel: "Closing balance" };
}

async function buildEmployeeLedger(employee, fy) {
  const { data: payments } = await supabase
    .from("expenses")
    .select("expense_date, amount, note")
    .eq("employee_id", employee.id)
    .eq("type", "Salary")
    .gte("expense_date", fy.start)
    .lte("expense_date", fy.end)
    .order("expense_date");

  const accrualMonths = monthsInRange(fy.start, fy.end);
  const txns = [
    ...accrualMonths.map((m) => ({
      date: m,
      type: "Salary accrued",
      detail: new Date(m).toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      debit: Number(employee.monthly_salary),
      credit: 0,
    })),
    ...(payments || []).map((p) => ({
      date: p.expense_date,
      type: "Payment",
      detail: p.note || "Salary payment",
      debit: 0,
      credit: Number(p.amount),
    })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const rows = toRunningBalance(0, txns);
  const closing = rows.length ? rows[rows.length - 1].balance : 0;
  return { opening: 0, rows, closing, hasOpening: false, balanceLabel: "Closing balance" };
}

// Generic ledger for any expense category (Rent, Sadar, Sadar Daily, and
// also Salary / Dealer Payment if you want a flat cross-entity total for
// that category rather than the per-dealer/per-employee view above).
async function buildExpenseTypeLedger(type, fy) {
  const { data } = await supabase
    .from("expenses")
    .select("expense_date, amount, note, employees(name), dealers(name)")
    .eq("type", type)
    .gte("expense_date", fy.start)
    .lte("expense_date", fy.end)
    .order("expense_date");

  const txns = (data || []).map((x) => ({
    date: x.expense_date,
    type,
    detail: x.note || x.employees?.name || x.dealers?.name || type,
    debit: Number(x.amount),
    credit: 0,
  }));

  const rows = toRunningBalance(0, txns);
  const total = rows.length ? rows[rows.length - 1].balance : 0;
  return { opening: 0, rows, closing: total, hasOpening: false, balanceLabel: "Total spent" };
}

async function buildLedger(ledgerType, entity, fy) {
  if (ledgerType === "dealer") return buildDealerLedger(entity, fy);
  if (ledgerType === "employee") return buildEmployeeLedger(entity, fy);
  return buildExpenseTypeLedger(entity.id, fy); // entity.id is the expense type string here
}

function ledgerToCsvBlock(title, fyLabel, result) {
  const { opening, rows, closing, hasOpening, balanceLabel } = result;
  let csv = `${title}\n${fyLabel}\n`;
  if (hasOpening) csv += `Opening balance,,,,${opening}\n`;
  csv += `Date,Type,Detail,Debit,Credit,Balance\n`;
  rows.forEach((r) => {
    const detail = String(r.detail || "").replace(/"/g, '""');
    csv += `${r.date},${r.type},"${detail}",${r.debit || ""},${r.credit || ""},${r.balance}\n`;
  });
  csv += `${balanceLabel},,,,,${closing}\n\n`;
  return csv;
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

const LEDGER_TYPES = [
  { key: "dealer", label: "Dealer" },
  { key: "employee", label: "Employee" },
  { key: "expense", label: "Expense category" },
];

export default function ReportsPage() {
  const [ledgerType, setLedgerType] = useState("dealer"); // "dealer" | "employee" | "expense"
  const [dealers, setDealers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [entityId, setEntityId] = useState("all");
  const [fyIdx, setFyIdx] = useState(0);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fy = FY_OPTIONS[fyIdx];

  const entities =
    ledgerType === "dealer"
      ? dealers
      : ledgerType === "employee"
      ? employees
      : EXPENSE_TYPES.map((t) => ({ id: t, name: t }));

  const entityNoun =
    ledgerType === "dealer" ? "dealer" : ledgerType === "employee" ? "employee" : "expense type";

  useEffect(() => {
    async function load() {
      const [{ data: d }, { data: e }] = await Promise.all([
        supabase.from("dealers").select("*").order("name"),
        supabase.from("employees").select("*").order("name"),
      ]);
      setDealers(d || []);
      setEmployees(e || []);
    }
    load();
  }, []);

  useEffect(() => {
    setEntityId("all");
    setPreview(null);
  }, [ledgerType]);

  async function loadPreview() {
    if (entityId === "all") {
      setPreview(null);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const entity = entities.find((x) => x.id === entityId);
      const result = await buildLedger(ledgerType, entity, fy);
      setPreview(result);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, fyIdx, ledgerType]);

  async function handleDownload() {
    setError("");
    setLoading(true);
    try {
      let csv = "";
      const targets = entityId === "all" ? entities : entities.filter((x) => x.id === entityId);

      if (targets.length === 0) {
        alert("Nothing to export.");
        setLoading(false);
        return;
      }

      for (const entity of targets) {
        const result = await buildLedger(ledgerType, entity, fy);
        const title =
          ledgerType === "dealer"
            ? `Dealer Ledger — ${entity.name}`
            : ledgerType === "employee"
            ? `Employee Salary Ledger — ${entity.name}`
            : `Expense Ledger — ${entity.name}`;
        csv += ledgerToCsvBlock(title, fy.label, result);
      }

      const scope = entityId === "all" ? "all" : targets[0].name.replace(/\s+/g, "_");
      downloadCsv(`${ledgerType}-ledger-${scope}-${fy.label.replace(/\s+/g, "_")}.csv`, csv);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="card">
        <h2 className="font-display font-semibold text-lg mb-1">Ledger reports</h2>
        <p className="text-xs text-stone-500 mb-4">
          Dealer ledgers carry an opening balance from before the selected financial year.
          Employee salary ledgers and expense-category ledgers show only the selected financial
          year — for employees, salary is computed from their current monthly rate, so there's no
          meaningful opening balance if that rate changed over time.
        </p>

        <div className="flex flex-wrap gap-3 items-end mb-4">
          <div className="min-w-[180px]">
            <label className="field-label">Ledger type</label>
            <select className="input" value={ledgerType} onChange={(e) => setLedgerType(e.target.value)}>
              {LEDGER_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="field-label">
              {ledgerType === "dealer" ? "Dealer" : ledgerType === "employee" ? "Employee" : "Expense type"}
            </label>
            <select className="input" value={entityId} onChange={(e) => setEntityId(e.target.value)}>
              <option value="all">All {entityNoun === "expense type" ? "expense types" : `${entityNoun}s`}</option>
              {entities.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="field-label">Financial year</label>
            <select className="input" value={fyIdx} onChange={(e) => setFyIdx(Number(e.target.value))}>
              {FY_OPTIONS.map((f, i) => (
                <option key={f.label} value={i}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={handleDownload} disabled={loading}>
            {loading ? "Preparing…" : "Download CSV"}
          </button>
        </div>
        {error && <div className="text-xs text-red mb-2">{error}</div>}
        {entityId === "all" && (
          <p className="text-xs text-stone-500">
            "All" downloads one CSV with a separate ledger section per {entityNoun}. Pick a
            specific one above to preview it here first.
          </p>
        )}
      </div>

      {entityId !== "all" && preview && (
        <div className="card">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-display font-semibold text-lg">
              {entities.find((x) => x.id === entityId)?.name} — {fy.label}
            </h2>
            <span className="text-xs text-stone-500">
              {preview.balanceLabel}:{" "}
              <span
                className={
                  preview.closing > 0
                    ? preview.balanceLabel === "Total spent"
                      ? "text-ink font-semibold"
                      : "text-red font-semibold"
                    : "text-bottle font-semibold"
                }
              >
                {fmt(Math.abs(preview.closing))}
                {preview.balanceLabel !== "Total spent" &&
                  (preview.closing > 0 ? " due" : preview.closing < 0 ? " advance" : "")}
              </span>
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Detail</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {preview.hasOpening && (
                  <tr>
                    <td colSpan={5} className="text-stone-500 text-xs italic">
                      Opening balance
                    </td>
                    <td className="text-right font-mono text-xs italic">{fmt(preview.opening)}</td>
                  </tr>
                )}
                {preview.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-stone-400 italic text-sm py-3">
                      No transactions in this period.
                    </td>
                  </tr>
                ) : (
                  preview.rows.map((r, idx) => (
                    <tr key={idx}>
                      <td>{r.date}</td>
                      <td>{r.type}</td>
                      <td>{r.detail}</td>
                      <td className="text-right font-mono">{r.debit ? fmt(r.debit) : ""}</td>
                      <td className="text-right font-mono">{r.credit ? fmt(r.credit) : ""}</td>
                      <td className="text-right font-mono">{fmt(r.balance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
