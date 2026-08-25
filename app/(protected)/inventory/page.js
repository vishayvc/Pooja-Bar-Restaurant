"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fmt } from "@/lib/helpers";

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
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState({ category: "Whisky", name: "", size: "" });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .order("category")
      .order("name");
    if (error) setError(error.message);
    setItems(data || []);
  }

  async function addItem(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    const { error } = await supabase.from("inventory_items").insert({
      category: form.category,
      name: form.name.trim(),
      size: form.size.trim(),
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ ...form, name: "", size: "" });
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

  const filtered = items.filter((i) => i.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      <div className="card">
        <h2 className="font-display font-semibold text-lg mb-1">Inventory master — add item</h2>
        <p className="text-xs text-stone-500 mb-3">
          Creates the catalog entry. Stock starts at 0 and fills in once a purchase is logged
          against it.
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
          <div className="min-w-[140px]">
            <label className="field-label">Size (optional)</label>
            <input
              className="input"
              placeholder="e.g. 750, 1L"
              value={form.size}
              onChange={(e) => setForm({ ...form, size: e.target.value })}
            />
          </div>
          <button className="btn-primary" disabled={saving}>
            {saving ? "Adding…" : "Add to catalog"}
          </button>
        </form>
        {error && <div className="text-xs text-red mt-2">{error}</div>}
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-display font-semibold text-lg">Current stock</h2>
          <input
            className="input max-w-[200px]"
            placeholder="Filter by name…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
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
              filtered.map((i) => (
                <tr key={i.id}>
                  <td>
                    <span className={`tag ${TAG_CLASS[i.category] || ""}`}>{i.category}</span>
                  </td>
                  <td>{i.name}</td>
                  <td>{i.size || "—"}</td>
                  <td className={`text-right font-mono ${i.stock < 10 ? "text-red font-bold" : ""}`}>
                    {i.stock}
                  </td>
                  <td className="text-right font-mono">{fmt(i.purchase_rate)}</td>
                  <td className="text-right font-mono">{fmt(i.selling_rate)}</td>
                  <td className="text-right font-mono">{fmt(i.stock * i.purchase_rate)}</td>
                  <td className="text-right">
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