"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fmt, todayStr } from "@/lib/helpers";

export default function ExpensesPage() {
  const [types, setTypes] = useState([]); // {name, requires_employee, requires_dealer, is_system}
  const [employees, setEmployees] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [log, setLog] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [form, setForm] = useState({
    date: todayStr(),
    type: "",
    subId: "",
    amount: "",
    note: "",
  });

  const [showManageTypes, setShowManageTypes] = useState(false);
  const [newType, setNewType] = useState({ name: "", requires: "none" }); // requires: none | employee | dealer
  const [savingType, setSavingType] = useState(false);
  const [typeError, setTypeError] = useState("");
  const [deletingType, setDeletingType] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [{ data: t }, { data: emp }, { data: deal }, { data: exp }] = await Promise.all([
      supabase.from("expense_types").select("*").order("name"),
      supabase.from("employees").select("*").order("name"),
      supabase.from("dealers").select("*").order("name"),
      supabase
        .from("expenses")
        .select("*, employees(name), dealers(name)")
        .order("expense_date", { ascending: false })
        .limit(100),
    ]);
    setTypes(t || []);
    setEmployees(emp || []);
    setDealers(deal || []);
    setLog(exp || []);
    setForm((f) => ({
      ...f,
      type: f.type || t?.[0]?.name || "",
      subId: f.subId || emp?.[0]?.id || "",
    }));
  }

  function currentType() {
    return types.find((t) => t.name === form.type);
  }

  function onTypeChange(typeName) {
    const t = types.find((x) => x.name === typeName);
    let subId = "";
    if (t?.requires_employee) subId = employees[0]?.id || "";
    if (t?.requires_dealer) subId = dealers[0]?.id || "";
    setForm({ ...form, type: typeName, subId });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    const amount = Number(form.amount);
    if (!amount) return;
    const t = currentType();
    if (t?.requires_employee && !form.subId) {
      setError("Choose an employee.");
      return;
    }
    if (t?.requires_dealer && !form.subId) {
      setError("Choose a dealer.");
      return;
    }
    setSaving(true);
    const payload = {
      expense_date: form.date,
      type: form.type,
      amount,
      note: form.note.trim() || null,
      employee_id: t?.requires_employee ? form.subId : null,
      dealer_id: t?.requires_dealer ? form.subId : null,
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

  async function deleteExpense(x) {
    if (!confirm(`Delete this ${x.type} expense of ${fmt(x.amount)} dated ${x.expense_date}?`)) return;
    setDeletingId(x.id);
    setError("");
    const { error } = await supabase.from("expenses").delete().eq("id", x.id);
    setDeletingId(null);
    if (error) {
      setError(error.message);
      return;
    }
    load();
  }

  async function addType(e) {
    e.preventDefault();
    if (!newType.name.trim()) return;
    setSavingType(true);
    setTypeError("");
    const { error } = await supabase.from("expense_types").insert({
      name: newType.name.trim(),
      requires_employee: newType.requires === "employee",
      requires_dealer: newType.requires === "dealer",
      is_system: false,
    });
    setSavingType(false);
    if (error) {
      setTypeError(error.message);
      return;
    }
    setNewType({ name: "", requires: "none" });
    load();
  }

  async function deleteType(t) {
    if (t.is_system) return;
    if (!confirm(`Delete expense type "${t.name}"? Only possible if no expenses use it.`)) return;
    setDeletingType(t.name);
    setTypeError("");
    const { error } = await supabase.from("expense_types").delete().eq("name", t.name);
    setDeletingType(null);
    if (error) {
      setTypeError(
        error.message.includes("foreign key")
          ? `"${t.name}" is already used by existing expenses and can't be deleted.`
          : error.message
      );
      return;
    }
    load();
  }

  const activeType = currentType();

  return (
    <div>
      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-display font-semibold text-lg">New expense</h2>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setShowManageTypes((v) => !v)}
          >
            {showManageTypes ? "Hide" : "Manage"} expense types
          </button>
        </div>

        {showManageTypes && (
          <div className="mb-4 p-3 rounded-md border border-line bg-paper2">
            <form onSubmit={addType} className="flex flex-wrap gap-3 items-end mb-3">
              <div className="flex-1 min-w-[160px]">
                <label className="field-label">New type name</label>
                <input
                  className="input"
                  placeholder="e.g. Electricity"
                  value={newType.name}
                  onChange={(e) => setNewType({ ...newType, name: e.target.value })}
                  required
                />
              </div>
              <div className="min-w-[160px]">
                <label className="field-label">Requires selecting</label>
                <select
                  className="input"
                  value={newType.requires}
                  onChange={(e) => setNewType({ ...newType, requires: e.target.value })}
                >
                  <option value="none">Nothing extra</option>
                  <option value="employee">An employee</option>
                  <option value="dealer">A dealer</option>
                </select>
              </div>
              <button className="btn-primary" disabled={savingType}>
                {savingType ? "Adding…" : "Add type"}
              </button>
            </form>
            {typeError && <div className="text-xs text-red mb-2">{typeError}</div>}
            <div className="flex flex-wrap gap-2">
              {types.map((t) => (
                <span
                  key={t.name}
                  className="tag bg-stone-200 text-stone-700 inline-flex items-center gap-1.5"
                >
                  {t.name}
                  {t.requires_employee && <span className="opacity-60">· employee</span>}
                  {t.requires_dealer && <span className="opacity-60">· dealer</span>}
                  {!t.is_system && (
                    <button
                      type="button"
                      onClick={() => deleteType(t)}
                      disabled={deletingType === t.name}
                      title="Delete this type"
                      className="ml-1 text-red hover:text-red font-bold leading-none"
                    >
                      {deletingType === t.name ? "…" : "×"}
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

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
                {types.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            {activeType?.requires_employee && (
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
            {activeType?.requires_dealer && (
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
        <div className="overflow-x-auto">
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Detail</th>
              <th className="text-right">Amount</th>
              <th>Note</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {log.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-stone-400 italic text-sm py-3">
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
                  <td className="text-right">
                    <button
                      onClick={() => deleteExpense(x)}
                      disabled={deletingId === x.id}
                      title="Delete expense"
                      className="text-xs font-semibold px-2 py-1 rounded-md border border-red/40 text-red hover:bg-red/10"
                    >
                      {deletingId === x.id ? "…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
