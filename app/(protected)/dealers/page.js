"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fmt } from "@/lib/helpers";

export default function DealersPage() {
  const [ledger, setLedger] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("dealer_ledger")
      .select("*")
      .order("name");
    if (error) setError(error.message);
    setLedger(data || []);
  }

  async function addDealer(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const { error } = await supabase.from("dealers").insert({ name: name.trim(), phone: phone.trim() || null });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    setPhone("");
    load();
  }

  return (
    <div>
      <div className="card">
        <h2 className="font-display font-semibold text-lg mb-1">Add dealer</h2>
        <form onSubmit={addDealer} className="flex flex-wrap gap-3 items-end mt-3">
          <div className="flex-1 min-w-[160px]">
            <label className="field-label">Dealer name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="field-label">Phone (optional)</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <button className="btn-primary" disabled={saving}>
            {saving ? "Adding…" : "Add dealer"}
          </button>
        </form>
        {error && <div className="text-xs text-red mt-2">{error}</div>}
      </div>

      <div className="card">
        <h2 className="font-display font-semibold text-lg mb-1">Dealer ledger</h2>
        <p className="text-xs text-stone-500 mb-3">
          Balance = total purchased on account − total paid via "Dealer Payment" expenses.
        </p>
         <div className="overflow-x-auto">
        <table className="data">
          <thead>
            <tr>
              <th>Dealer</th>
              <th>Phone</th>
              <th className="text-right">Total purchased</th>
              <th className="text-right">Total paid</th>
              <th className="text-right">Balance due</th>
            </tr>
          </thead>
          <tbody>
            {ledger.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-stone-400 italic text-sm py-3">
                  No dealers yet.
                </td>
              </tr>
            ) : (
              ledger.map((d) => (
                <tr key={d.dealer_id}>
                  <td>{d.name}</td>
                  <td>{d.phone || "—"}</td>
                  <td className="text-right font-mono">{fmt(d.total_purchased)}</td>
                  <td className="text-right font-mono">{fmt(d.total_paid)}</td>
                  <td
                    className={`text-right font-mono font-bold ${
                      d.balance_due > 0 ? "text-red" : "text-bottle"
                    }`}
                  >
                    {fmt(d.balance_due)}
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
