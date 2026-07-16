import Link from "next/link";
import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { listVendors, getTodaysBirthdays } from "@/lib/users";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Gerente",
  SELLER: "Vendedor",
  SUPPORT: "Suporte",
  MEDIATOR: "Mediador",
};

function currency(v: number | null) {
  if (v === null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default async function PerfilPage() {
  const session = await requireView("perfil");
  const editable = canEdit(session.user.role, "perfil");
  const [vendors, birthdaysToday] = await Promise.all([listVendors(), getTodaysBirthdays()]);

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="font-display text-[22px] text-ink">Perfil — Mediador</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Acesso total a todos os perfis · cadastro de vendedores
          </p>
        </div>
        {editable && (
          <Link
            href="/perfil/novo"
            className="rounded-lg bg-gold-solid px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-gold-solid-bright"
          >
            ＋ Novo vendedor
          </Link>
        )}
      </div>

      {birthdaysToday.length > 0 && (
        <div className="mb-4 rounded-xl border border-gold bg-gold/10 px-4 py-2.5 text-sm text-ink">
          🎂 Aniversário hoje: {birthdaysToday.map((v) => v.name).join(", ")}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gold-deep/28 bg-surface">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              {["Nome", "Perfil", "Função", "Meta 1", "Meta 2", "Comissão", "Aniversário", ""].map((h) => (
                <th
                  key={h}
                  className="border-b border-gold-deep/30 px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.id}>
                <td className="border-b border-dashed border-gold-deep/18 px-3 py-2.5 text-ink">{v.name}</td>
                <td className="border-b border-dashed border-gold-deep/18 px-3 py-2.5 text-ink-muted">
                  {ROLE_LABELS[v.role] ?? v.role}
                </td>
                <td className="border-b border-dashed border-gold-deep/18 px-3 py-2.5 text-ink-muted">
                  {v.jobTitle ?? "—"}
                </td>
                <td className="border-b border-dashed border-gold-deep/18 px-3 py-2.5 text-ink tabular-nums">
                  {currency(v.goal1 ? Number(v.goal1) : null)}
                </td>
                <td className="border-b border-dashed border-gold-deep/18 px-3 py-2.5 text-ink tabular-nums">
                  {currency(v.goal2 ? Number(v.goal2) : null)}
                </td>
                <td className="border-b border-dashed border-gold-deep/18 px-3 py-2.5 text-ink-muted tabular-nums">
                  {v.commissionPct1 ? `${Number(v.commissionPct1)}%` : "—"} /{" "}
                  {v.commissionPct2 ? `${Number(v.commissionPct2)}%` : "—"}
                </td>
                <td className="border-b border-dashed border-gold-deep/18 px-3 py-2.5 text-ink-muted tabular-nums">
                  {v.birthday ? v.birthday.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}
                </td>
                <td className="border-b border-dashed border-gold-deep/18 px-3 py-2.5 text-right">
                  {editable && (
                    <Link href={`/perfil/${v.id}`} className="text-gold-bright hover:underline">
                      Editar
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
