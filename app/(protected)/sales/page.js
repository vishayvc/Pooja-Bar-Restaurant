"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fmt, todayStr, itemLabel } from "@/lib/helpers";

function Kpi({ label, value, sub }) {
  return (
    <div className="kpi">
      <div className="text-[11px] uppercase tracking-wide text-stone-500 font-semibold truncate">
        {label}
      </div>
      <div className="font-display font-semibold text-xl mt-1 text-ink">{value}</div>
      {sub && <div className="text-[11px] text-stone-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function SalesPage() {
  const [date, setDate] = useState(todayStr());
  const [items, setItems] = useState([]);
  const [saleDay, setSaleDay] = useState(null);
  const [lines, setLines] = useState([]);
  const [history, setHistory] = useState([]);
  const [snapshot, setSnapshot] = useState({ openingValue: 0, closingValue: 0, rows: [] });

  const [lineItemId, setLineItemId] = useState("");
  const [lineQty, setLineQty] = useState("");
  const [cash, setCash] = useState("0");
  const [upi, setUpi] = useState("0");
  const [error, setError] = useState("");
  const [savingLine, setSavingLine] = useState(false);
  const [savingCollections, setSavingCollections] = useState(false);
  const [deletingDayId, setDeletingDayId] = useState(null);

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

  // Stock isn't stored per-date, only as a running total. But since every
  // change to it happens through a purchase or a sale, we can reconstruct
  // what it was at the start (and end) of any date by working backward
  // from the current total: undo everything that happened after that date.
  async function loadStockSnapshot(d) {
    const [{ data: allItems }, { data: purchasesFrom }, { data: daysFrom }] = await Promise.all([
      supabase.from("inventory_items").select("id, category, name, size, stock, purchase_rate"),
      supabase.from("purchases").select("item_id, qty, purchase_date").gte("purchase_date", d),
      supabase.from("sale_days").select("id, sale_date").gte("sale_date", d),
    ]);

    const dayIds = (daysFrom || []).map((x) => x.id);
    const dateByDayId = Object.fromEntries((daysFrom || []).map((x) => [x.id, x.sale_date]));

    let salesFrom = [];
    if (dayIds.length) {
      const { data } = await supabase
        .from("sale_lines")
        .select("item_id, qty, sale_day_id")
        .in("sale_day_id", dayIds);
      salesFrom = (data || []).map((s) => ({ ...s, sale_date: dateByDayId[s.sale_day_id] }));
    }

    const rows = (allItems || [])
      .map((item) => {
        const purchAfter = (purchasesFrom || [])
          .filter((p) => p.item_id === item.id && p.purchase_date > d)
          .reduce((s, p) => s + Number(p.qty), 0);
        const purchOn = (purchasesFrom || [])
          .filter((p) => p.item_id === item.id && p.purchase_date === d)
          .reduce((s, p) => s + Number(p.qty), 0);
        const saleAfter = salesFrom
          .filter((s) => s.item_id === item.id && s.sale_date > d)
          .reduce((s, x) => s + Number(x.qty), 0);
        const saleOn = salesFrom
          .filter((s) => s.item_id === item.id && s.sale_date === d)
          .reduce((s, x) => s + Number(x.qty), 0);

        const closing = Number(item.stock) - purchAfter + saleAfter;
        const opening = closing - purchOn + saleOn;

        return {
          item,
          opening,
          purchased: purchOn,
          sold: saleOn,
          closing,
        };
      })
      .filter((r) => r.purchased !== 0 || r.sold !== 0); // only items that moved that day

    const openingValue = (allItems || []).reduce((s, item) => {
      const row = rows.find((r) => r.item.id === item.id);
      const opening = row ? row.opening : Number(item.stock); // untouched items: opening = current = closing
      return s + opening * Number(item.purchase_rate);
    }, 0);
    const closingValue = (allItems || []).reduce((s, item) => {
      const row = rows.find((r) => r.item.id === item.id);
      const closing = row ? row.closing : Number(item.stock);
      return s + closing * Number(item.purchase_rate);
    }, 0);

    setSnapshot({ openingValue, closingValue, rows });
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

    await loadStockSnapshot(d);
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

  function currentLineTotal() {
    return lines.reduce((s, l) => s + Number(l.value), 0);
  }

  function handleCashChange(v) {
    setCash(v);
    const total = currentLineTotal();
    const rem = total - (Number(v) || 0);
    setUpi(rem > 0 ? String(Math.round(rem * 100) / 100) : "0");
  }

  function handleUpiChange(v) {
    setUpi(v);
    const total = currentLineTotal();
    const rem = total - (Number(v) || 0);
    setCash(rem > 0 ? String(Math.round(rem * 100) / 100) : "0");
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

  async function deleteSaleDay(h) {
    if (
      !confirm(
        `Delete the entire saved sale for ${h.sale_date} (${fmt(
          h.sale_value
        )})? This removes all its line items and restores their stock. This cannot be undone.`
      )
    )
      return;
    setDeletingDayId(h.id);
    setError("");
    const { error } = await supabase.from("sale_days").delete().eq("id", h.id);
    setDeletingDayId(null);
    if (error) {
      setError(error.message);
      return;
    }
    await Promise.all([loadDay(date), loadItems(), loadHistory()]);
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
    csv += `Opening inventory value,${snapshot.openingValue}\nClosing inventory value,${snapshot.closingValue}\n`;
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sales-${date}.csv`;
    a.click();
  }

  const lineTotal = currentLineTotal();
  const collectionsTotal = (Number(cash) || 0) + (Number(upi) || 0);
  const diff = collectionsTotal - lineTotal;
  const reconciled = Math.abs(diff) < 0.01;

  const selectedItem = items.find((i) => i.id === lineItemId);
  const linePreview = selectedItem ? Number(lineQty || 0) * selectedItem.selling_rate : 0;
  const isToday = date === todayStr();

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
        <p className="text-xs text-stone-500 mb-4">
          Each line saves — and updates stock — immediately. Cash/UPI collection is saved
          separately below.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <Kpi
            label="Opening inventory value"
            value={fmt(snapshot.openingValue)}
            sub={isToday ? "start of today" : `start of ${date}`}
          />
          <Kpi
            label="Closing inventory value"
            value={fmt(snapshot.closingValue)}
            sub={isToday ? "as of now" : `end of ${date}`}
          />
        </div>

        <form onSubmit={addLine} className="flex flex-wrap gap-3 items-end mb-4">
          <div className="flex-1 min-w-[200px]">
            <label className="field-label">Item (brand · size)</label>
            <select className="input" value={lineItemId} onChange={(e) => setLineItemId(e.target.value)}>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {itemLabel(i)} — {i.stock} in stock
                </option>
              ))}
            </select>
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
        </table></div>

        <div className="text-[12px] uppercase tracking-wide font-bold text-stone-500 mb-2">
          Collections for the day
        </div>
        <p className="text-xs text-stone-500 mb-2">
          Enter one of Cash or UPI — the other fills in automatically with whatever's left of the
          line total. You can still overwrite either afterward.
        </p>
        <div className="flex flex-wrap gap-3 items-end mb-2">
          <div className="min-w-[140px]">
            <label className="field-label">Cash (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={cash}
              onChange={(e) => handleCashChange(e.target.value)}
            />
          </div>
          <div className="min-w-[140px]">
            <label className="field-label">UPI (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={upi}
              onChange={(e) => handleUpiChange(e.target.value)}
            />
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
        <h2 className="font-display font-semibold text-lg mb-1">Opening / closing stock by item</h2>
        <p className="text-xs text-stone-500 mb-3">
          Items with any purchase or sale on the selected date. Values use each item's current
          purchase rate, not necessarily the historical rate on that date.
        </p>
        <div className="overflow-x-auto">
        <table className="data">
          <thead>
            <tr>
              <th>Item</th>
              <th className="text-right">Opening</th>
              <th className="text-right">Purchased</th>
              <th className="text-right">Sold</th>
              <th className="text-right">Closing</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-stone-400 italic text-sm py-3">
                  No stock movement on this date.
                </td>
              </tr>
            ) : (
              snapshot.rows.map((r) => (
                <tr key={r.item.id}>
                  <td>{itemLabel(r.item)}</td>
                  <td className="text-right font-mono">{r.opening}</td>
                  <td className="text-right font-mono">{r.purchased || ""}</td>
                  <td className="text-right font-mono">{r.sold || ""}</td>
                  <td className="text-right font-mono">{r.closing}</td>
                </tr>
              ))
            )}
          </tbody>
        </table></div>
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
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-stone-400 italic text-sm py-3">
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
                  <td className="text-right">
                    <button
                      onClick={() => deleteSaleDay(h)}
                      disabled={deletingDayId === h.id}
                      title="Delete this entire day's sale"
                      className="text-xs font-semibold px-2 py-1 rounded-md border border-red/40 text-red hover:bg-red/10"
                    >
                      {deletingDayId === h.id ? "…" : "Delete"}
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
