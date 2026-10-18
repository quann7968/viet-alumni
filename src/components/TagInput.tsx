"use client";

import { useEffect, useRef, useState } from "react";
import { searchTags } from "@/app/actions";

type Props = {
  kind: string;
  value: string[];
  onChange?: (v: string[]) => void;
  single?: boolean;
  placeholder?: string;
  /** When set, renders hidden inputs so the field works inside a plain <form>. */
  name?: string;
  max?: number;
};

/** Autocomplete tag picker. Picks an existing tag or creates a new one (de-duplicated by slug on the server). */
export default function TagInput({ kind, value: controlled, onChange, single, placeholder, name, max = 20 }: Props) {
  const [inner, setInner] = useState<string[]>(controlled);
  const value = onChange ? controlled : inner;
  const set = (v: string[]) => (onChange ? onChange(v) : setInner(v));
  const [text, setText] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await searchTags(kind, text);
      setOptions(res.filter((o) => !value.some((v) => v.toLowerCase() === o.toLowerCase())));
    }, 180);
    return () => clearTimeout(timer.current);
  }, [text, open, kind, value]);

  const add = (raw: string) => {
    const v = raw.replace(/\s+/g, " ").trim();
    if (!v) return;
    if (single) set([v]);
    else if (value.length < max && !value.some((x) => x.toLowerCase() === v.toLowerCase())) set([...value, v]);
    setText("");
    setOpen(false);
  };

  return (
    <div className="relative">
      {name && value.map((v) => <input key={v} type="hidden" name={name} value={v} />)}
      <div className="flex flex-wrap gap-1.5">
        {value.map((v) => (
          <span key={v} className="chip border-brand-100 bg-brand-50 text-brand-700">
            {v}
            <button type="button" aria-label={`Remove ${v}`} className="ml-1.5 text-base leading-none"
              onClick={() => set(value.filter((x) => x !== v))}>×</button>
          </span>
        ))}
      </div>
      {(!single || value.length === 0) && (
        <input
          className="input mt-1.5"
          value={text}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(text); }
            if (e.key === "Backspace" && !text && value.length) set(value.slice(0, -1));
          }}
        />
      )}
      {open && (options.length > 0 || text.trim()) && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {options.map((o) => (
            <li key={o}><button type="button" className="w-full px-3 py-2.5 text-left text-sm hover:bg-slate-100" onMouseDown={(e) => { e.preventDefault(); add(o); }}>{o}</button></li>
          ))}
          {text.trim() && !options.some((o) => o.toLowerCase() === text.trim().toLowerCase()) && (
            <li><button type="button" className="w-full px-3 py-2.5 text-left text-sm font-medium text-brand-700 hover:bg-slate-100" onMouseDown={(e) => { e.preventDefault(); add(text); }}>+ {text.trim()}</button></li>
          )}
        </ul>
      )}
    </div>
  );
}
