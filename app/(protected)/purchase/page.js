"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fmt, todayStr, itemLabel } from "@/lib/helpers";
import SearchableSelect from "@/components/SearchableSelect";

export default function PurchasePage() {
  const [dealers, setDealers] = useState([]);
  const [items, setItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [form, setForm] = useState({
    date: todayStr(),
    dealerId: "",
    itemId: "",
    qty: "",
    rate: "",
    sellRate: "",
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [{ data: d }, { data: i }, { data: h }] = await Promise.all([
      supabase.from("dealers").select("*").order("name"),
      supabase.from("inventory_items").select("*").order("category").order("name"),
      supabase
        .from("purchases")
        .select("*, dealers(name), inventory_items(name, size, category)")
        .order("purchase_date", { ascending: false })
        .limit(50),
    ]);
    setDealers(d || []);
    setItems(i || []);
    setHistory(h || []);
    setForm((f) => ({
      ...f,
      dealerId: f.dealerId || d?.[0]?.id || "",
      itemId: f.itemId || i?.[0]?.id || "",
    }));
  }

  function onItemChange(itemId) {
    const item = items.find((x) => x.id === itemId);
    setForm((f) => ({
      ...f,
      itemId,
      rate: item ? item.purchase_rate : f.rate,
      sellRate: item ? item.selling_rate : f.sellRate,
    }));
  }

  const itemOptions = items.map((i) => ({
    value: i.id,
    label: itemLabel(i),
    searchText: `${i.name} ${i.size || ""} ${i.category}`,
  }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.dealerId || !form.itemId || !form.qty || form.rate === "" || form.sellRate === "") return;
    setSaving(true);
    const { error } = await supabase.from("purchases").insert({
      purchase_date: form.date,
      dealer_id: form.dealerId,
      item_id: form.itemId,
      qty: Number(form.qty),
      rate: Number(form.rate),
      selling_rate: Number(form.sellRate),
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm((f) => ({ ...f, qty: "" }));
    load();
  }

  async function deletePurchase(p) {
    if (
      !confirm(
        `Delete this purchase of ${p.qty} × ${itemLabel(p.inventory_items)} from ${
          p.dealers?.name || "dealer"
        } on ${p.purchase_date}? This will reduce that item's stock back down.`
      )
    )
      return;
    setDeletingId(p.id);
    setError("");
    const { error } = await supabase.from("purchases").delete().eq("id", p.id);
    setDeletingId(null);
    if (error) {
      setError(error.message);
      return;
    }
    load();
  }

  const previewValue = Number(form.qty || 0) * Number(form.rate || 0);

  return (
    <div>
      <div className="card">
        <h2 className="font-display font-semibold text-lg mb-1">New purchase</h2>
        <p className="text-xs text-stone-500 mb-3">
          Recorded as a credit purchase against the dealer. Updates that item's stock, purchase
          rate and selling rate immediately (a database trigger does this — not the browser).
        </p>
        <form onSubmit={submit}>
          <div className="flex flex-wrap gap-3 mb-3">
            <div className="flex-1 min-w-[140px]">
              <label className="field-label">Date</label>
              <input
                type="date"
                className="input"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="field-label">Dealer</label>
              <select
                className="input"
                value={form.dealerId}
                onChange={(e) => setForm({ ...form, dealerId: e.target.value })}
                required
              >
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[220px]">
              <label className="field-label">Item (brand · size)</label>
              <SearchableSelect
                options={itemOptions}
                value={form.itemId}
                onChange={onItemChange}
                placeholder="Type to search item…"
                required
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mb-3">
            <div className="flex-1 min-w-[120px]">
              <label className="field-label">Quantity</label>
              <input
                type="number"
                min="1"
                className="input"
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
                required
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="field-label">Purchase rate (₹/unit)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
                required
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="field-label">Selling rate (₹/unit)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.sellRate}
                onChange={(e) => setForm({ ...form, sellRate: e.target.value })}
                required
              />
            </div>
            <div className="min-w-[140px]">
              <label className="field-label">Purchase value</label>
              <input className="input font-mono" disabled value={fmt(previewValue)} />
            </div>
          </div>
          {error && <div className="text-xs text-red mb-2">{error}</div>}
          <button className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Record purchase"}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 className="font-display font-semibold text-lg mb-3">Purchase history</h2>
        <div className="overflow-x-auto">
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Dealer</th>
              <th>Item</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Rate</th>
              <th className="text-right">Value</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-stone-400 italic text-sm py-3">
                  No purchases logged yet.
                </td>
              </tr>
            ) : (
              history.map((p) => (
                <tr key={p.id}>
                  <td>{p.purchase_date}</td>
                  <td>{p.dealers?.name || "—"}</td>
                  <td>{itemLabel(p.inventory_items)}</td>
                  <td className="text-right font-mono">{p.qty}</td>
                  <td className="text-right font-mono">{fmt(p.rate)}</td>
                  <td className="text-right font-mono">{fmt(p.value)}</td>
                  <td className="text-right">
                    <button
                      onClick={() => deletePurchase(p)}
                      disabled={deletingId === p.id}
                      title="Delete purchase"
                      className="text-xs font-semibold px-2 py-1 rounded-md border border-red/40 text-red hover:bg-red/10"
                    >
                      {deletingId === p.id ? "…" : "Delete"}
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
