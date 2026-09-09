"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A searchable dropdown ("combobox") for long lists.
 *
 * Props:
 * - options: array of { value, label, searchText? } — searchText defaults to label
 * - value: currently selected value
 * - onChange: (value) => void
 * - placeholder: shown when nothing is typed / selected
 */
export default function SearchableSelect({ options, value, onChange, placeholder = "Search…", required }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = query.trim()
    ? options.filter((o) => (o.searchText || o.label).toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  function pick(opt) {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered[highlight]) pick(filtered[highlight]);
      else setOpen(true);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <input
        ref={inputRef}
        className="input"
        placeholder={selected ? selected.label : placeholder}
        value={open ? query : ""}
        onFocus={() => {
          setOpen(true);
          setHighlight(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        required={required && !value}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-line bg-white shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-stone-400 italic">No matches.</div>
          ) : (
            filtered.map((o, idx) => (
              <div
                key={o.value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
                onMouseEnter={() => setHighlight(idx)}
                className={`px-3 py-2 text-sm cursor-pointer ${
                  idx === highlight ? "bg-amber/20" : ""
                } ${o.value === value ? "font-semibold" : ""}`}
              >
                {o.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
