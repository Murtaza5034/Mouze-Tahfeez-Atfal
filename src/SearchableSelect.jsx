import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, X, Search } from "lucide-react";
import "./searchable-select.css";

/* Reusable premium searchable dropdown.
 * Supports optional grouping (via option.group) and an optional clear button.
 * props:
 *   options: [{ value, label, sub?, group? }]      *   value    : string      *   onChange : (value) => void      *   placeholder : string      *   name        : optional hidden-input name (for FormData forms)      *   clearable    : show an X to reset      *   disabled    : bool      *   className    : extra class      *   searchPlaceholder : text for the filter box      *   allowEmptyText : text shown as a disabled empty entry when no value      *   emptyValue   : optional leading option (value '') label      *   emptyFirst   : when true, prepend an empty 'Select…' option      *   open / setOpen (optional controlled) */
export default function SearchableSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Select…",
  name,
  clearable = false,
  disabled = false,
  className = "",
  searchPlaceholder = "Search…",
  emptyValue,
  emptyFirst = true,
  noEmpty = false,
  searchable = true,
  exclude = null,
  groupHeaderFor = (g) => g,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const selId = String(value ?? "");

  useEffect(() => {
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      if (searchable && inputRef.current) {
        setTimeout(() => inputRef.current.focus(), 30);
      }
    }
  }, [open, searchable]);

  const selected = options.find(o => String(o.value) === selId);

  const visibleOptions = () => {
    let opts = options;
    if (exclude) {
      opts = opts.filter(o => !exclude(String(o.value)));
    }
    if (showEmptyRow()) opts = [makeEmpty(), ...opts];
    if (!query.trim()) return opts;
    const q = query.trim().toLowerCase();
    return opts.filter(o => {
      if (o.value === "" && showEmptyRow()) return true;
      return (
        String(o.label || "").toLowerCase().includes(q) ||
        String(o.group || "").toLowerCase().includes(q) ||
        String(o.sub || "").toLowerCase().includes(q)
      );
    });
  };

  const showEmptyRow = () => !noEmpty && emptyFirst && options.length > 0 && emptyValue !== undefined;

  const makeEmpty = () => ({ value: "", label: emptyValue, group: undefined });

  const optList = visibleOptions();
  const hasGroups = optList.some(o => o.group);

  const grouped = [];
  let ungrouped = [];
  if (hasGroups) {
    const map = new Map();
    optList.forEach(o => {
      if (!o.group) { ungrouped.push(o); return; }
      if (!map.has(o.group)) map.set(o.group, []);
      map.get(o.group).push(o);
    });
    map.forEach((items, g) => grouped.push({ g, items }));
  } else {
    ungrouped = optList;
  }

  const select = (o) => {
    const formEl = rootRef.current ? rootRef.current.closest("form") : null;
    onChange(o.value, formEl);
    setOpen(false);
  };

  return (
    <div className={`searchable-select ${className} ${open ? "is-open" : ""} ${disabled ? "is-disabled" : ""}`} ref={rootRef}>
      {name && <input type="hidden" name={name} value={selId} />}
      <button
        type="button"
        className="searchable-select-trigger"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`searchable-select-trigger-label ${selId ? "" : "is-placeholder"}`}>
          {selected ? selected.label : placeholder}
        </span>
        {clearable && selId && (
          <span
            className="searchable-select-clear"
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
          >
            <X size={14} />
          </span>
        )}
        <ChevronDown size={15} className={`searchable-select-chevron ${open ? "rotated" : ""}`} />
      </button>

      {open && (
        <div className="searchable-select-panel" role="listbox">
          {searchable && (
            <div className="searchable-select-search">
              <Search size={14} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
              />
              {query && (
                <button type="button" className="searchable-select-search-clear" onClick={() => setQuery("")}>
                  <X size={13} />
                </button>
              )}
            </div>
          )}
          <div className="searchable-select-list">
            {ungrouped.length > 0 && (
              <div className="searchable-select-group">
                {ungrouped.map(o => (
                  <button
                    key={String(o.value)}
                    type="button"
                    role="option"
                    aria-selected={String(o.value) === selId}
                    className={`searchable-select-item ${String(o.value) === selId ? "is-selected" : ""}`}
                    onClick={() => select(o)}
                  >
                    <span className="searchable-select-item-label">{o.label}</span>
                    {o.sub && <span className="searchable-select-item-sub">{o.sub}</span>}
                  </button>
                ))}
              </div>
            )}
            {grouped.map(({ g, items }) => (
              <div className="searchable-select-group" key={g}>
                <div className="searchable-select-group-head">{groupHeaderFor(g)}</div>
                {items.map(o => (
                  <button
                    key={String(o.value)}
                    type="button"
                    role="option"
                    aria-selected={String(o.value) === selId}
                    className={`searchable-select-item ${String(o.value) === selId ? "is-selected" : ""}`}
                    onClick={() => select(o)}
                  >
                    <span className="searchable-select-item-label">{o.label}</span>
                    {o.sub && <span className="searchable-select-item-sub">{o.sub}</span>}
                  </button>
                ))}
              </div>
            ))}
            {optList.length === 0 && (
              <div className="searchable-select-empty">No options</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}