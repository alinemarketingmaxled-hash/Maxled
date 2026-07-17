"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { searchAction } from "@/app/(app)/actions";
import type { SearchResult } from "@/lib/search";

function currency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      const clear = setTimeout(() => setResult(null), 0);
      return () => clearTimeout(clear);
    }
    const timer = setTimeout(() => {
      setLoading(true);
      searchAction(query).then((r) => {
        setResult(r);
        setLoading(false);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasResults = result && (result.contacts.length > 0 || result.deals.length > 0);
  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative max-w-sm flex-1">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Buscar contatos, negócios…"
        className="w-full rounded-lg border border-gold-deep/35 bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-gold"
      />
      {showDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-80 overflow-y-auto rounded-lg border border-gold-deep/40 bg-surface shadow-lg">
          {loading && <p className="px-3 py-2.5 text-[12px] text-ink-faint">Buscando…</p>}
          {!loading && !hasResults && (
            <p className="px-3 py-2.5 text-[12px] text-ink-faint">Nada encontrado.</p>
          )}
          {!loading && result && result.contacts.length > 0 && (
            <div>
              <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                Clientes
              </div>
              {result.contacts.map((c) => (
                <Link
                  key={c.id}
                  href={`/vendas?id=${c.id}`}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 text-[13px] text-ink hover:bg-surface-2"
                >
                  {c.name}
                  {c.accountName && <span className="text-ink-faint"> — {c.accountName}</span>}
                </Link>
              ))}
            </div>
          )}
          {!loading && result && result.deals.length > 0 && (
            <div>
              <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                Negócios
              </div>
              {result.deals.map((d) => (
                <Link
                  key={d.id}
                  href={`/negocios/${d.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-[13px] text-ink hover:bg-surface-2"
                >
                  <span>{d.name}</span>
                  <span className="text-[11px] text-gold-bright">{currency(d.value)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
