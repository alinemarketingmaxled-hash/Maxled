import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/erp/portal";
import { Logo } from "@/components/shell/Logo";
import { PortalNav } from "@/components/portal/PortalNav";
import { portalSignOut } from "./actions";

export const metadata = { title: "Portal do cliente | MAX LED" };

/** Área do cliente (§4.14). Cabeçalho escuro da marca, conteúdo no tema
 * claro operacional. Nenhum link para módulos internos. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { contactId, portalUser } = await requireCustomer();
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { accountName: true, firstName: true, lastName: true },
  });
  const company = contact?.accountName || `${contact?.firstName ?? ""} ${contact?.lastName ?? ""}`.trim();

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="border-b border-gold-deep/40 bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Logo size={30} />
          <div className="min-w-0">
            <p className="font-display text-[15px] leading-tight text-ink">
              MAX LED <span className="text-gold-bright">Portal do cliente</span>
            </p>
            <p className="truncate text-[11px] text-ink-muted">
              {company} · {portalUser.name}
            </p>
          </div>
          <PortalNav signOutAction={portalSignOut} />
        </div>
      </header>
      <div className="ops-light flex-1">
        <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
