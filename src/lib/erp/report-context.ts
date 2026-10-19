import "server-only";
import type { Session } from "next-auth";
import { resolveCompanyScope } from "@/lib/erp/company";
import { allowedTabs, parseFilters, type ReportTab } from "@/lib/erp/reports";

/** Resolve empresa(s), aba permitida e filtros a partir da query — usado
 * pela página e pela exportação CSV, para as duas aplicarem exatamente as
 * mesmas checagens. */
export async function resolveReportContext(session: Session, sp: Record<string, string | undefined>) {
  const scope = await resolveCompanyScope(session, sp.empresa);
  const tabs = allowedTabs(session);
  const tab = (tabs.find((t) => t.key === sp.aba)?.key ?? tabs[0]?.key ?? null) as ReportTab | null;
  const filters = parseFilters(sp);
  const companyLabel = (id: string) => {
    const c = scope.ctx.companies.find((x) => x.id === id);
    return c ? `${c.code} - ${c.tradeName || c.name}` : id;
  };
  return { ...scope, tabs, tab, filters, companyLabel };
}
