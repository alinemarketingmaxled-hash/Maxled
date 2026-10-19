import Link from "next/link";
import type { ReactNode } from "react";

/** Vocabulário visual comum das telas do ERP — mesmas classes/tokens do
 * CRM (gold/ink/surface), para os módulos parecerem um sistema só. */

export const inputCls =
  "w-full rounded-md border border-gold-deep/40 bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold disabled:opacity-60";
export const labelCls = "flex flex-col gap-1 text-xs text-ink-muted";
export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-gold-solid px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-gold-solid-bright disabled:cursor-not-allowed disabled:opacity-50";
export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-gold-deep px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-50";
export const btnDanger =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-critical/60 px-3.5 py-2 text-xs font-semibold text-critical transition-colors hover:bg-critical/10 disabled:cursor-not-allowed disabled:opacity-50";
export const thCls =
  "whitespace-nowrap border-b border-gold-deep/30 px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint";
export const tdCls = "border-b border-dashed border-gold-deep/20 px-3 py-2 align-top text-[13px] text-ink";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-[22px] text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-gold-deep/25 bg-surface p-4 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gold">{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export type Tone = "good" | "info" | "warning" | "critical" | "neutral" | "gold";

const TONE_CLS: Record<Tone, string> = {
  good: "border-good/40 bg-good/10 text-good",
  info: "border-info/40 bg-info/10 text-info",
  warning: "border-warning/40 bg-warning/10 text-warning",
  critical: "border-critical/40 bg-critical/10 text-critical",
  neutral: "border-gold-deep/30 bg-surface-2 text-ink-muted",
  gold: "border-gold/50 bg-gold/10 text-gold",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE_CLS[tone]}`}>
      {children}
    </span>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-xl border border-gold-deep/25 bg-surface p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone ? TONE_CLS[tone].split(" ").pop() : "text-ink"}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11.5px] text-ink-faint">{hint}</p>}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-gold-deep/45 px-6 py-8 text-center text-sm text-ink-muted">{children}</div>
  );
}

/** Tabela com rolagem horizontal própria — no celular a página não rola
 * de lado, só a tabela (§6). */
export function Table({ head, children, empty }: { head: ReactNode; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gold-deep/25 bg-surface">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`${labelCls} ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

/** Abas por link (estado na URL, funciona sem JS). */
export function Tabs({ tabs, active }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1.5 border-b border-gold-deep/25 pb-2">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            t.key === active ? "bg-gold-solid text-black" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
          }`}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 opacity-70">{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}

export function NoCompany() {
  return <EmptyState>Seu usuário não está vinculado a nenhuma empresa. Peça acesso ao administrador.</EmptyState>;
}
