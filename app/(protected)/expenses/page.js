"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fmt, todayStr } from "@/lib/helpers";

const TYPES = ["Salary", "Rent", "Dealer Payment", "Sadar", "Sadar Daily"];

export default function ExpensesPage() {
  const [employees, setEmployees] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [log, setLog] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    date: todayStr(),
    type: "Salary",
    subId: "",
    amount: "",
    note: "",
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [{ data: emp }, { data: deal }, { data: exp }] = await Promise.all([
      supabase.from("employees").select("*").order("name"),
      supabase.from("dealers").select("*").order("name"),
      supabase
        .from("expenses")
        .select("*, employees(name), dealers(name)")
        .order("expense_date", { ascending: false })
        .limit(100),
    ]);
    setEmployees(emp || []);
    setDealers(deal || []);
    setLog(exp || []);
    setForm((f) => ({ ...f, subId: f.subId || emp?.[0]?.id || "" }));
  }

  function onTypeChange(type) {
    let subId = "";
    if (type === "Salary") subId = employees[0]?.id || "";
    if (type === "Dealer Payment") subId = dealers[0]?.id || "";
    setForm({ ...form, type, subId });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    const amount = Number(form.amount);
    if (!amount) return;
    if (form.type === "Salary" && !form.subId) {
      setError("Choose an employee.");
      return;
    }
    if (form.type === "Dealer Payment" && !form.subId) {
      setError("Choose a dealer.");
      return;
    }
    setSaving(true);
    const payload = {
      expense_date: form.date,
      type: form.type,
      amount,
      note: form.note.trim() || null,
      employee_id: form.type === "Salary" ? form.subId : null,
      dealer_id: form.type === "Dealer Payment" ? form.subId : null,
    };
    const { error } = await supabase.from("expenses").insert(payload);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ ...form, amount: "", note: "" });
    load();
  }

  return (
    <div>
      <div className="card">
        <h2 className="font-display font-semibold text-lg mb-3">New expense</h2>
        <form onSubmit={submit}>
          <div className="flex flex-wrap gap-3 mb-3">
            <div className="min-w-[140px]">
              <label className="field-label">Date</label>
              <input
                type="date"
                className="input"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
            <div className="min-w-[160px]">
              <label className="field-label">Expense type</label>
              <select className="input" value={form.type} onChange={(e) => onTypeChange(e.target.value)}>
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            {form.type === "Salary" && (
              <div className="min-w-[160px]">
                <label className="field-label">Employee</label>
                <select
                  className="input"
                  value={form.subId}
                  onChange={(e) => setForm({ ...form, subId: e.target.value })}
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {form.type === "Dealer Payment" && (
              <div className="min-w-[160px]">
                <label className="field-label">Dealer</label>
                <select
                  className="input"
                  value={form.subId}
                  onChange={(e) => setForm({ ...form, subId: e.target.value })}
                >
                  {dealers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mb-3">
            <div className="min-w-[140px]">
              <label className="field-label">Amount (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="field-label">Note (optional)</label>
              <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          {error && <div className="text-xs text-red mb-2">{error}</div>}
          <button className="btn-primary" disabled={saving}>
            {saving ? "Adding…" : "Add expense"}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 className="font-display font-semibold text-lg mb-3">Expense log</h2>
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Detail</th>
              <th className="text-right">Amount</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {log.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-stone-400 italic text-sm py-3">
                  No expenses logged yet.
                </td>
              </tr>
            ) : (
              log.map((x) => (
                <tr key={x.id}>
                  <td>{x.expense_date}</td>
                  <td>{x.type}</td>
                  <td>{x.employees?.name || x.dealers?.name || "—"}</td>
                  <td className="text-right font-mono">{fmt(x.amount)}</td>
                  <td>{x.note || ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
