"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fmt, todayStr, itemLabel } from "@/lib/helpers";
import SearchableSelect from "@/components/SearchableSelect";

export default function SalesPage() {
  const [date, setDate] = useState(todayStr());
  const [items, setItems] = useState([]);
  const [saleDay, setSaleDay] = useState(null); // row from sale_days, or null if none yet
  const [lines, setLines] = useState([]); // sale_lines joined with inventory_items
  const [history, setHistory] = useState([]);

  const [lineItemId, setLineItemId] = useState("");
  const [lineQty, setLineQty] = useState("");
  const [cash, setCash] = useState("0");
  const [upi, setUpi] = useState("0");
  const [error, setError] = useState("");
  const [savingLine, setSavingLine] = useState(false);
  const [savingCollections, setSavingCollections] = useState(false);

  useEffect(() => {
    loadItems();
    loadHistory();
  }, []);

  useEffect(() => {
    loadDay(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function loadItems() {
    const { data } = await supabase.from("inventory_items").select("*").order("category").order("name");
    setItems(data || []);
    if (data && data.length && !lineItemId) setLineItemId(data[0].id);
  }

  async function loadHistory() {
    const { data } = await supabase
      .from("daily_sales_summary")
      .select("*")
      .order("sale_date", { ascending: false })
      .limit(30);
    setHistory(data || []);
  }

  async function loadDay(d) {
    setError("");
    const { data: dayRow } = await supabase.from("sale_days").select("*").eq("sale_date", d).maybeSingle();
    setSaleDay(dayRow || null);
    setCash(dayRow ? String(dayRow.cash) : "0");
    setUpi(dayRow ? String(dayRow.upi) : "0");

    if (dayRow) {
      const { data: lineRows } = await supabase
        .from("sale_lines")
        .select("*, inventory_items(name, size, category, stock)")
        .eq("sale_day_id", dayRow.id)
        .order("created_at");
      setLines(lineRows || []);
    } else {
      setLines([]);
    }
  }

  async function ensureSaleDay() {
    if (saleDay) return saleDay;
    const { data, error } = await supabase
      .from("sale_days")
      .insert({ sale_date: date, cash: Number(cash) || 0, upi: Number(upi) || 0 })
      .select()
      .single();
    if (error) throw error;
    setSaleDay(data);
    return data;
  }

  async function addLine(e) {
    e.preventDefault();
    setError("");
    const item = items.find((i) => i.id === lineItemId);
    const qty = Number(lineQty);
    if (!item || !qty) return;
    setSavingLine(true);
    try {
      const day = await ensureSaleDay();
      const { error } = await supabase.from("sale_lines").insert({
        sale_day_id: day.id,
        item_id: item.id,
        qty,
        rate: item.selling_rate,
      });
      if (error) throw error;
      setLineQty("");
      await Promise.all([loadDay(date), loadItems(), loadHistory()]);
    } catch (err) {
      setError(err.message);
    }
    setSavingLine(false);
  }

  async function removeLine(id) {
    setError("");
    const { error } = await supabase.from("sale_lines").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    await Promise.all([loadDay(date), loadItems(), loadHistory()]);
  }

  async function saveCollections() {
    setSavingCollections(true);
    setError("");
    try {
      const day = await ensureSaleDay();
      const { error } = await supabase
        .from("sale_days")
        .update({ cash: Number(cash) || 0, upi: Number(upi) || 0 })
        .eq("id", day.id);
      if (error) throw error;
      await Promise.all([loadDay(date), loadHistory()]);
    } catch (err) {
      setError(err.message);
    }
    setSavingCollections(false);
  }

  function downloadCsv() {
    if (!lines.length) {
      alert("No sale lines saved for this date yet.");
      return;
    }
    let csv = "Item,Qty,Rate,Value\n";
    lines.forEach((l) => {
      csv += `${itemLabel(l.inventory_items)},${l.qty},${l.rate},${l.value}\n`;
    });
    csv += `\nCash,${cash}\nUPI,${upi}\nTotal Sale Value,${lineTotal}\n`;
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sales-${date}.csv`;
    a.click();
  }

  const itemOptions = items.map((i) => ({
    value: i.id,
    label: `${itemLabel(i)} — ${i.stock} in stock`,
    searchText: `${i.name} ${i.size || ""} ${i.category}`,
  }));

  const lineTotal = lines.reduce((s, l) => s + Number(l.value), 0);
  const collectionsTotal = (Number(cash) || 0) + (Number(upi) || 0);
  const diff = collectionsTotal - lineTotal;
  const reconciled = Math.abs(diff) < 0.01;

  const selectedItem = items.find((i) => i.id === lineItemId);
  const linePreview = selectedItem ? Number(lineQty || 0) * selectedItem.selling_rate : 0;

  return (
    <div>
      <div className="card">
        <div className="flex justify-between items-center flex-wrap gap-3 mb-1">
          <h2 className="font-display font-semibold text-lg">Sale entry</h2>
          <div className="min-w-[160px]">
            <label className="field-label">Date</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-stone-500 mb-3">
          Each line saves — and updates stock — immediately. Cash/UPI collection is saved
          separately below.
        </p>

        <form onSubmit={addLine} className="flex flex-wrap gap-3 items-end mb-4">
          <div className="flex-1 min-w-[220px]">
            <label className="field-label">Item (brand · size)</label>
            <SearchableSelect
              options={itemOptions}
              value={lineItemId}
              onChange={setLineItemId}
              placeholder="Type to search item…"
              required
            />
          </div>
          <div className="min-w-[100px]">
            <label className="field-label">Qty sold</label>
            <input
              type="number"
              min="1"
              className="input"
              value={lineQty}
              onChange={(e) => setLineQty(e.target.value)}
              required
            />
          </div>
          <div className="min-w-[120px]">
            <label className="field-label">Line value</label>
            <input className="input font-mono" disabled value={fmt(linePreview)} />
          </div>
          <button className="btn-primary" disabled={savingLine}>
            {savingLine ? "Adding…" : "Add line"}
          </button>
        </form>

        {error && <div className="text-xs text-red mb-3">{error}</div>}

        <div className="overflow-x-auto">
          <table className="data mb-4">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-stone-400 italic text-sm py-3">
                    No lines added for this date yet.
                  </td>
                </tr>
              ) : (
                lines.map((l) => (
                  <tr key={l.id}>
                    <td>{itemLabel(l.inventory_items)}</td>
                    <td className="text-right font-mono">{l.qty}</td>
                    <td className="text-right font-mono">{fmt(l.rate)}</td>
                    <td className="text-right font-mono">{fmt(l.value)}</td>
                    <td>
                      <button className="btn-ghost" onClick={() => removeLine(l.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="text-[12px] uppercase tracking-wide font-bold text-stone-500 mb-2">
          Collections for the day
        </div>
        <div className="flex flex-wrap gap-3 items-end mb-2">
          <div className="min-w-[140px]">
            <label className="field-label">Cash (₹)</label>
            <input type="number" min="0" step="0.01" className="input" value={cash} onChange={(e) => setCash(e.target.value)} />
          </div>
          <div className="min-w-[140px]">
            <label className="field-label">UPI (₹)</label>
            <input type="number" min="0" step="0.01" className="input" value={upi} onChange={(e) => setUpi(e.target.value)} />
          </div>
        </div>

        <div
          className={`text-sm rounded px-3 py-2 mb-3 ${
            reconciled ? "bg-bottle/10 text-bottle border border-bottle/30" : "bg-red/10 text-red border border-red/30"
          }`}
        >
          {reconciled
            ? `Line items total ${fmt(lineTotal)} — matches cash + UPI (${fmt(collectionsTotal)}).`
            : `Mismatch: line items total ${fmt(lineTotal)}, cash + UPI = ${fmt(collectionsTotal)} (${
                diff > 0 ? "+" : ""
              }${fmt(diff)}). Check quantities, rates, or the collection entry.`}
        </div>

        <div className="flex gap-2">
          <button className="btn-primary" onClick={saveCollections} disabled={savingCollections}>
            {savingCollections ? "Saving…" : "Save cash / UPI collection"}
          </button>
          <button className="btn-ghost" onClick={downloadCsv}>
            Download this date as CSV
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="font-display font-semibold text-lg mb-3">Opening / closing stock</h2>
        <p className="text-xs text-stone-500 mb-3">For items sold on the selected date.</p>
        <div className="overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Opening</th>
                <th className="text-right">Sold</th>
                <th className="text-right">Closing</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-stone-400 italic text-sm py-3">
                    Add sale lines to see stock movement.
                  </td>
                </tr>
              ) : (
                lines.map((l) => {
                  const closing = l.inventory_items?.stock ?? 0;
                  const opening = closing + l.qty;
                  return (
                    <tr key={l.id}>
                      <td>{itemLabel(l.inventory_items)}</td>
                      <td className="text-right font-mono">{opening}</td>
                      <td className="text-right font-mono">{l.qty}</td>
                      <td className="text-right font-mono">{closing}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="font-display font-semibold text-lg mb-3">Saved sales — recent dates</h2>
        <div className="overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th className="text-right">Sale value</th>
                <th className="text-right">Cash</th>
                <th className="text-right">UPI</th>
                <th className="text-right">Diff</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-stone-400 italic text-sm py-3">
                    No sales saved yet.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id}>
                    <td>{h.sale_date}</td>
                    <td className="text-right font-mono">{fmt(h.sale_value)}</td>
                    <td className="text-right font-mono">{fmt(h.cash)}</td>
                    <td className="text-right font-mono">{fmt(h.upi)}</td>
                    <td className={`text-right font-mono ${Math.abs(h.diff) < 0.01 ? "text-bottle" : "text-red"}`}>
                      {fmt(h.diff)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
