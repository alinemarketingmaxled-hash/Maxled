"use client";

import { useEffect, useState } from "react";
import { ActionForm, type ClientActionResult } from "@/components/erp/ActionForm";
import { btnPrimary, inputCls, labelCls } from "@/components/erp/ui";

type ContactHit = { id: string; label: string; detail: string; name: string; email: string };

export function CreateAccessForm({
  action,
  search,
}: {
  action: (fd: FormData) => Promise<ClientActionResult>;
  search: (q: string) => Promise<ContactHit[]>;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ContactHit[]>([]);
  const [picked, setPicked] = useState<ContactHit | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (picked || q.trim().length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await search(q);
      if (!cancelled) setHits(res);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, picked, search]);

  return (
    <ActionForm action={action} resetOnSuccess className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className={`${labelCls} relative sm:col-span-2`}>
        <span>Cliente</span>
        {picked ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink">
            <span>
              {picked.label} <span className="text-xs text-ink-faint">{picked.detail}</span>
            </span>
            <button type="button" className="text-xs font-semibold text-gold" onClick={() => { setPicked(null); setQ(""); setHits([]); }}>
              Trocar
            </button>
          </div>
        ) : (
          <>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (e.target.value.trim().length < 2) setHits([]);
              }}
              placeholder="Busque por razão social, nome, e-mail ou CNPJ"
              className={inputCls}
            />
            {hits.length > 0 && (
              <ul className="absolute top-full z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-gold-deep/40 bg-surface shadow-lg">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-surface-2"
                      onClick={() => {
                        setPicked(h);
                        setHits([]);
                        if (!name) setName(h.name);
                        if (!email) setEmail(h.email);
                      }}
                    >
                      {h.label} <span className="block text-[11px] text-ink-faint">{h.detail}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <input type="hidden" name="contactId" value={picked?.id ?? ""} />
      </div>
      <label className={labelCls}>
        <span>Nome de quem acessa</span>
        <input name="name" required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </label>
      <label className={labelCls}>
        <span>E-mail de login</span>
        <input name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
      </label>
      <label className={labelCls}>
        <span>Senha temporária (mín. 8 caracteres)</span>
        <input name="password" type="text" required minLength={8} autoComplete="off" className={inputCls} />
      </label>
      <div className="flex items-end">
        <button type="submit" className={btnPrimary} disabled={!picked}>
          Criar acesso
        </button>
      </div>
    </ActionForm>
  );
}
