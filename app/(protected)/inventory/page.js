"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fmt, itemLabel } from "@/lib/helpers";

const CATEGORIES = ["Whisky", "Beer", "Snacks", "Cigarette", "Water", "Cold Drink"];
const TAG_CLASS = {
  Whisky: "bg-amber/20 text-amberdark",
  Beer: "bg-yellow-200/60 text-yellow-800",
  Snacks: "bg-stone-200 text-stone-600",
  Cigarette: "bg-red/10 text-red",
  Water: "bg-bottle/10 text-bottle",
  "Cold Drink": "bg-sky-100 text-sky-700",
};

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState({
    category: "Whisky",
    name: "",
    size: "",
    initialStock: "",
    purchaseRate: "",
    sellingRate: "",
  });

  const [adjustingId, setAdjustingId] = useState(null);
  const [adjustCount, setAdjustCount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [savingAdjust, setSavingAdjust] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [{ data, error }, { data: adj }] = await Promise.all([
      supabase.from("inventory_items").select("*").order("category").order("name"),
      supabase
        .from("stock_adjustments")
        .select("*, inventory_items(name, size, category)")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    if (error) setError(error.message);
    setItems(data || []);
    setAdjustments(adj || []);
  }

  async function addItem(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    const openingStock = Number(form.initialStock) || 0;
    const { data: inserted, error } = await supabase
      .from("inventory_items")
      .insert({
        category: form.category,
        name: form.name.trim(),
        size: form.size.trim(),
        stock: openingStock,
        purchase_rate: Number(form.purchaseRate) || 0,
        selling_rate: Number(form.sellingRate) || 0,
      })
      .select()
      .single();
    if (error) {
      setSaving(false);
      setError(error.message);
      return;
    }
    if (openingStock > 0) {
      await supabase.from("stock_adjustments").insert({
        item_id: inserted.id,
        old_stock: 0,
        new_stock: openingStock,
        reason: "Opening stock at creation",
      });
    }
    setSaving(false);
    setForm({ ...form, name: "", size: "", initialStock: "", purchaseRate: "", sellingRate: "" });
    load();
  }

  async function deleteItem(i) {
    if (i.stock !== 0) return;
    if (!confirm(`Delete "${i.name}${i.size ? " " + i.size : ""}" from the catalog?`)) return;
    setDeletingId(i.id);
    setError("");
    const { error } = await supabase.from("inventory_items").delete().eq("id", i.id);
    setDeletingId(null);
    if (error) {
      setError(error.message);
      return;
    }
    load();
  }

  function startAdjust(item) {
    setAdjustingId(item.id);
    setAdjustCount(String(item.stock));
    setAdjustReason("");
  }

  function cancelAdjust() {
    setAdjustingId(null);
    setAdjustCount("");
    setAdjustReason("");
  }

  async function saveAdjust(item) {
    const newStock = Number(adjustCount);
    if (adjustCount === "" || isNaN(newStock) || newStock < 0) {
      setError("Enter a valid stock count.");
      return;
    }
    if (newStock === item.stock) {
      cancelAdjust();
      return;
    }
    setSavingAdjust(true);
    setError("");

    const { error: updateErr } = await supabase
      .from("inventory_items")
      .update({ stock: newStock })
      .eq("id", item.id);

    if (updateErr) {
      setSavingAdjust(false);
      setError(updateErr.message);
      return;
    }

    await supabase.from("stock_adjustments").insert({
      item_id: item.id,
      old_stock: item.stock,
      new_stock: newStock,
      reason: adjustReason.trim() || null,
    });

    setSavingAdjust(false);
    cancelAdjust();
    load();
  }

  const filtered = items.filter((i) => i.name.toLowerCase().includes(filter.toLowerCase()));

  function downloadCsv() {
    if (filtered.length === 0) {
      alert("No items to export.");
      return;
    }
    let csv = "Category,Item,Size,Stock,Purchase Rate,Selling Rate,Stock Value\n";
    filtered.forEach((i) => {
      const name = String(i.name).replace(/"/g, '""');
      csv += `${i.category},"${name}",${i.size || ""},${i.stock},${i.purchase_rate},${i.selling_rate},${
        i.stock * i.purchase_rate
      }\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div>
      <div className="card">
        <h2 className="font-display font-semibold text-lg mb-1">Inventory master — add item</h2>
        <p className="text-xs text-stone-500 mb-3">
          Creates the catalog entry. Leave stock/rates at 0 if you'll fill them in later via a
          Purchase — or set them here directly, e.g. for opening/takeover stock.
        </p>
        <form onSubmit={addItem} className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[140px]">
            <label className="field-label">Category</label>
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="field-label">Brand / name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="min-w-[120px]">
            <label className="field-label">Size (optional)</label>
            <input
              className="input"
              placeholder="e.g. 750, 1L"
              value={form.size}
              onChange={(e) => setForm({ ...form, size: e.target.value })}
            />
          </div>
          <div className="min-w-[130px]">
            <label className="field-label">Opening stock</label>
            <input
              type="number"
              min="0"
              className="input"
              placeholder="0"
              value={form.initialStock}
              onChange={(e) => setForm({ ...form, initialStock: e.target.value })}
            />
          </div>
          <div className="min-w-[140px]">
            <label className="field-label">Purchase rate (₹/unit)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input"
              placeholder="0"
              value={form.purchaseRate}
              onChange={(e) => setForm({ ...form, purchaseRate: e.target.value })}
            />
          </div>
          <div className="min-w-[140px]">
            <label className="field-label">Selling rate (₹/unit)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input"
              placeholder="0"
              value={form.sellingRate}
              onChange={(e) => setForm({ ...form, sellingRate: e.target.value })}
            />
          </div>
          <button className="btn-primary" disabled={saving}>
            {saving ? "Adding…" : "Add to catalog"}
          </button>
        </form>
        {error && <div className="text-xs text-red mt-2">{error}</div>}
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-1">
          <h2 className="font-display font-semibold text-lg">Current stock</h2>
          <div className="flex gap-2 items-center">
            <input
              className="input max-w-[200px]"
              placeholder="Filter by name…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <button className="btn-ghost" onClick={downloadCsv}>
              Download CSV
            </button>
          </div>
        </div>
        <p className="text-xs text-stone-500 mb-3">
          Click a stock number to correct it directly — for a physical count, opening stock at
          takeover, damage, etc. This doesn't touch dealers or purchase history, it just sets the
          count.
        </p>
        <div className="overflow-x-auto">
        <table className="data">
          <thead>
            <tr>
              <th>Category</th>
              <th>Item</th>
              <th>Size</th>
              <th className="text-right">Stock</th>
              <th className="text-right">Purchase rate</th>
              <th className="text-right">Selling rate</th>
              <th className="text-right">Stock value</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-stone-400 italic text-sm py-3">
                  No matching items.
                </td>
              </tr>
            ) : (
              filtered.map((i) => {
                const isAdjusting = adjustingId === i.id;
                return (
                  <tr key={i.id}>
                    <td>
                      <span className={`tag ${TAG_CLASS[i.category] || ""}`}>{i.category}</span>
                    </td>
                    <td>{i.name}</td>
                    <td>{i.size || "—"}</td>
                    <td className={`text-right font-mono ${i.stock < 10 ? "text-red font-bold" : ""}`}>
                      {isAdjusting ? (
                        <input
                          type="number"
                          min="0"
                          autoFocus
                          className="input font-mono text-right max-w-[100px] inline-block"
                          value={adjustCount}
                          onChange={(e) => setAdjustCount(e.target.value)}
                        />
                      ) : (
                        <button
                          onClick={() => startAdjust(i)}
                          title="Click to correct stock count"
                          className="hover:bg-amber/10 rounded px-1 -mx-1 transition-colors"
                        >
                          {i.stock}
                        </button>
                      )}
                    </td>
                    <td className="text-right font-mono">{fmt(i.purchase_rate)}</td>
                    <td className="text-right font-mono">{fmt(i.selling_rate)}</td>
                    <td className="text-right font-mono">{fmt(i.stock * i.purchase_rate)}</td>
                    <td className="text-right whitespace-nowrap">
                      {isAdjusting ? (
                        <div className="flex gap-2 items-center justify-end">
                          <input
                            className="input max-w-[140px]"
                            placeholder="Reason (optional)"
                            value={adjustReason}
                            onChange={(e) => setAdjustReason(e.target.value)}
                          />
                          <button
                            onClick={() => saveAdjust(i)}
                            disabled={savingAdjust}
                            className="text-xs font-semibold px-2 py-1 rounded-md border border-bottle/40 text-bottle hover:bg-bottle/10"
                          >
                            {savingAdjust ? "…" : "Save"}
                          </button>
                          <button
                            onClick={cancelAdjust}
                            className="text-xs font-semibold px-2 py-1 rounded-md border border-line text-stone-500 hover:bg-stone-100"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => deleteItem(i)}
                          disabled={i.stock !== 0 || deletingId === i.id}
                          title={i.stock === 0 ? "Delete item" : "Only items with zero stock can be deleted"}
                          className={`text-xs font-semibold px-2 py-1 rounded-md border ${
                            i.stock === 0
                              ? "border-red/40 text-red hover:bg-red/10"
                              : "border-line text-stone-300 cursor-not-allowed"
                          }`}
                        >
                          {deletingId === i.id ? "…" : "Delete"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table></div>
      </div>

      <div className="card">
        <h2 className="font-display font-semibold text-lg mb-3">Recent stock adjustments</h2>
        <div className="overflow-x-auto">
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Item</th>
              <th className="text-right">Old</th>
              <th className="text-right">New</th>
              <th className="text-right">Change</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {adjustments.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-stone-400 italic text-sm py-3">
                  No adjustments logged yet.
                </td>
              </tr>
            ) : (
              adjustments.map((a) => {
                const diff = Number(a.new_stock) - Number(a.old_stock);
                return (
                  <tr key={a.id}>
                    <td>{new Date(a.created_at).toLocaleDateString("en-IN")}</td>
                    <td>{itemLabel(a.inventory_items)}</td>
                    <td className="text-right font-mono">{a.old_stock}</td>
                    <td className="text-right font-mono">{a.new_stock}</td>
                    <td className={`text-right font-mono font-semibold ${diff >= 0 ? "text-bottle" : "text-red"}`}>
                      {diff > 0 ? "+" : ""}
                      {diff}
                    </td>
                    <td>{a.reason || ""}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
