"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fmt } from "@/lib/helpers";

export default function EmployeesPage() {
  const [ledger, setLedger] = useState([]);
  const [name, setName] = useState("");
  const [salary, setSalary] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editSalary, setEditSalary] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("employee_ledger")
      .select("*")
      .order("name");
    if (error) setError(error.message);
    setLedger(data || []);
  }

  async function addEmployee(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const { error } = await supabase.from("employees").insert({
      name: name.trim(),
      monthly_salary: Number(salary) || 0,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    setSalary("");
    load();
  }

  function startEdit(row) {
    setEditingId(row.employee_id);
    setEditSalary(String(row.monthly_salary));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditSalary("");
  }

  async function saveEdit(row) {
    setSavingEdit(true);
    setError("");
    const { error } = await supabase
      .from("employees")
      .update({ monthly_salary: Number(editSalary) || 0 })
      .eq("id", row.employee_id);
    setSavingEdit(false);
    if (error) {
      setError(error.message);
      return;
    }
    cancelEdit();
    load();
  }

  async function deleteEmployee(row) {
    if (row.total_paid_all_time !== 0) return;
    if (!confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    setDeletingId(row.employee_id);
    setError("");
    const { error } = await supabase.from("employees").delete().eq("id", row.employee_id);
    setDeletingId(null);
    if (error) {
      setError(error.message);
      return;
    }
    load();
  }

  return (
    <div>
      <div className="card">
        <h2 className="font-display font-semibold text-lg mb-1">Add employee</h2>
        <p className="text-xs text-stone-500 mb-3">
          Set their fixed monthly salary here. Log actual payments to them from the Expenses
          page using type "Salary" — those payments feed the "Paid this month" column below.
        </p>
        <form onSubmit={addEmployee} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="field-label">Employee name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="min-w-[160px]">
            <label className="field-label">Monthly salary (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
          </div>
          <button className="btn-primary" disabled={saving}>
            {saving ? "Adding…" : "Add employee"}
          </button>
        </form>
        {error && <div className="text-xs text-red mt-2">{error}</div>}
      </div>

      <div className="card">
        <h2 className="font-display font-semibold text-lg mb-1">Salary ledger — this month</h2>
        <p className="text-xs text-stone-500 mb-3">
          Outstanding = monthly salary − payments logged as "Salary" expenses this calendar
          month. Resets automatically at the start of each month.
        </p>
        <div className="overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Employee</th>
                <th className="text-right">Monthly salary</th>
                <th className="text-right">Paid this month</th>
                <th className="text-right">Outstanding</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-stone-400 italic text-sm py-3">
                    No employees yet.
                  </td>
                </tr>
              ) : (
                ledger.map((r) => {
                  const canDelete = r.total_paid_all_time === 0;
                  const isEditing = editingId === r.employee_id;
                  return (
                    <tr key={r.employee_id}>
                      <td>{r.name}</td>
                      <td className="text-right font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            autoFocus
                            className="input font-mono text-right max-w-[120px] inline-block"
                            value={editSalary}
                            onChange={(e) => setEditSalary(e.target.value)}
                          />
                        ) : (
                          fmt(r.monthly_salary)
                        )}
                      </td>
                      <td className="text-right font-mono">{fmt(r.paid_this_month)}</td>
                      <td
                        className={`text-right font-mono font-bold ${
                          r.outstanding > 0 ? "text-red" : "text-bottle"
                        }`}
                      >
                        {r.outstanding > 0 ? "+" : ""}
                        {fmt(r.outstanding)}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => saveEdit(r)}
                              disabled={savingEdit}
                              className="text-xs font-semibold px-2 py-1 rounded-md border border-bottle/40 text-bottle hover:bg-bottle/10"
                            >
                              {savingEdit ? "…" : "Save"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-xs font-semibold px-2 py-1 rounded-md border border-line text-stone-500 hover:bg-stone-100"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => startEdit(r)}
                              className="text-xs font-semibold px-2 py-1 rounded-md border border-line text-stone-600 hover:bg-stone-100"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteEmployee(r)}
                              disabled={!canDelete || deletingId === r.employee_id}
                              title={
                                canDelete
                                  ? "Delete employee"
                                  : "Only employees with no salary payment history can be deleted"
                              }
                              className={`text-xs font-semibold px-2 py-1 rounded-md border ${
                                canDelete
                                  ? "border-red/40 text-red hover:bg-red/10"
                                  : "border-line text-stone-300 cursor-not-allowed"
                              }`}
                            >
                              {deletingId === r.employee_id ? "…" : "Delete"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
