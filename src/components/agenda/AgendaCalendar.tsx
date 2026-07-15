"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export type CalendarItem = {
  date: string; // ISO date (yyyy-MM-dd)
  label: string;
  type: "task" | "deal";
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dayKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function AgendaCalendar({ items }: { items: CalendarItem[] }) {
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Date | null>(new Date());

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [items]);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingBlanks = getDay(monthStart);

  const selectedItems = selected ? (itemsByDay.get(dayKey(selected)) ?? []) : [];

  return (
    <div className="rounded-xl border border-gold-deep/30 bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setCursor((c) => subMonths(c, 1))}
          className="rounded-md px-2 py-1 text-ink-faint hover:text-gold-bright"
        >
          ‹
        </button>
        <span className="text-[13px] font-semibold capitalize text-ink">
          {format(cursor, "MMMM yyyy", { locale: ptBR })}
        </span>
        <button
          onClick={() => setCursor((c) => addMonths(c, 1))}
          className="rounded-md px-2 py-1 text-ink-faint hover:text-gold-bright"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map((d) => {
          const key = dayKey(d);
          const dayItems = itemsByDay.get(key) ?? [];
          const active = selected && isSameDay(d, selected);
          return (
            <button
              key={key}
              onClick={() => setSelected(d)}
              className={`flex aspect-square flex-col items-center justify-center rounded-md text-[11.5px] transition-colors ${
                active
                  ? "bg-gold text-black"
                  : isToday(d)
                    ? "border border-gold-deep text-gold-bright"
                    : isSameMonth(d, cursor)
                      ? "text-ink hover:bg-surface-2"
                      : "text-ink-faint/40 hover:bg-surface-2"
              }`}
            >
              {format(d, "d")}
              {dayItems.length > 0 && (
                <span
                  className={`mt-0.5 h-1 w-1 rounded-full ${active ? "bg-black" : "bg-gold-bright"}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-3 border-t border-gold-deep/20 pt-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            {format(selected, "d 'de' MMMM", { locale: ptBR })}
          </div>
          {selectedItems.length === 0 ? (
            <p className="text-[11.5px] text-ink-faint">Nada agendado neste dia.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {selectedItems.map((item, i) => (
                <li key={i} className="flex items-center gap-1.5 text-[12px] text-ink">
                  <span
                    className={`h-1.5 w-1.5 flex-none rounded-full ${item.type === "deal" ? "bg-warning" : "bg-gold-bright"}`}
                  />
                  {item.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
