"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fmt, todayStr, monthRange } from "@/lib/helpers";

function currentMonthStr() {
  return todayStr().slice(0, 7); // "YYYY-MM"
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]); // {id, name, monthly_salary}
  const [salaryExpenses, setSalaryExpenses] = useState([]); // {employee_id, expense_date, amount}
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr());

  const [name, setName] = useState("");
  const [salary, setSalary] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editSalary, setEditSalary] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setError("");
    const [{ data: emp, error: e1 }, { data: exp, error: e2 }] = await Promise.all([
      supabase.from("employees").select("id, name, monthly_salary").order("name"),
      supabase
        .from("expenses")
        .select("employee_id, expense_date, amount")
        .eq("type", "Salary"),
    ]);
    if (e1) setError(e1.message);
    if (e2) setError(e2.message);
    setEmployees(emp || []);
    setSalaryExpenses(exp || []);
  }

  // Derived ledger for whichever month is selected — recomputed locally,
  // no extra network round-trip needed when the month changes.
  const ledger = useMemo(() => {
    const { start, end } = monthRange(`${selectedMonth}-01`);
    return employees.map((emp) => {
      const paidThisMonth = salaryExpenses
        .filter((x) => x.employee_id === emp.id && x.expense_date >= start && x.expense_date <= end)
        .reduce((s, x) => s + Number(x.amount), 0);
      const totalPaidAllTime = salaryExpenses
        .filter((x) => x.employee_id === emp.id)
        .reduce((s, x) => s + Number(x.amount), 0);
      return {
        employee_id: emp.id,
        name: emp.name,
        monthly_salary: Number(emp.monthly_salary),
        paid_this_month: paidThisMonth,
        outstanding: Number(emp.monthly_salary) - paidThisMonth,
        total_paid_all_time: totalPaidAllTime,
      };
    });
  }, [employees, salaryExpenses, selectedMonth]);

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

  async function commitEdit(row) {
    if (editingId !== row.employee_id) return;
    const nextVal = Number(editSalary) || 0;
    setEditingId(null);
    if (nextVal === row.monthly_salary) return;
    setError("");
    const { error } = await supabase
      .from("employees")
      .update({ monthly_salary: nextVal })
      .eq("id", row.employee_id);
    if (error) {
      setError(error.message);
      return;
    }
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

  const isCurrentMonth = selectedMonth === currentMonthStr();

  return (
    <div>
      <div className="card">
        <h2 className="font-display font-semibold text-lg mb-1">Add employee</h2>
        <p className="text-xs text-stone-500 mb-3">
          Set their fixed monthly salary here. Log actual payments to them from the Expenses
          page using type "Salary" — those payments feed the "Paid" column below.
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
        <div className="flex justify-between items-center flex-wrap gap-3 mb-1">
          <h2 className="font-display font-semibold text-lg">Salary ledger</h2>
          <div className="min-w-[160px]">
            <label className="field-label">Month</label>
            <input
              type="month"
              className="input"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-stone-500 mb-3">
          Outstanding = monthly salary − "Salary" expenses logged in the selected month. Click a
          salary amount to edit it inline —{" "}
          {isCurrentMonth
            ? "this sets the rate used going forward."
            : "note: this changes the current rate everywhere, not just for the month you're viewing, since past rates aren't stored separately."}
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
                            onBlur={() => commitEdit(r)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.currentTarget.blur();
                              } else if (e.key === "Escape") {
                                cancelEdit();
                                e.currentTarget.blur();
                              }
                            }}
                          />
                        ) : (
                          <button
                            onClick={() => startEdit(r)}
                            title="Click to edit"
                            className="hover:bg-amber/10 rounded px-1 -mx-1 transition-colors"
                          >
                            {fmt(r.monthly_salary)}
                          </button>
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
