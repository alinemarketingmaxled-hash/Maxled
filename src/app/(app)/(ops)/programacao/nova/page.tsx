import { redirect } from "next/navigation";
import { requireView } from "@/lib/require-permission";
import { canEdit } from "@/lib/permissions";
import { getCompanyContext, type CompanyContext } from "@/lib/erp/company";
import { loadScheduleFormOptions } from "@/lib/erp/schedule-queries";
import { toDateInput } from "@/lib/erp/format";
import { NoCompany, PageHeader } from "@/components/erp/ui";
import { BackLink } from "@/components/shell/BackLink";
import { ScheduleForm } from "@/components/erp/programacao/ScheduleForm";
import { saveScheduleAction } from "../actions";

export default async function NovaProgramacaoPage() {
  const session = await requireView("programacao");
  if (!canEdit(session.user.role, "programacao")) redirect("/programacao");
  let ctx: CompanyContext;
  try {
    ctx = await getCompanyContext(session);
  } catch {
    return <NoCompany />;
  }
  const opts = await loadScheduleFormOptions(session, ctx.active.id);
  return (
    <div>
      <BackLink href="/programacao" label="Programação" />
      <PageHeader title="Nova programação" subtitle={`${ctx.active.code} · ${ctx.active.tradeName || ctx.active.name}`} />
      <ScheduleForm
        action={saveScheduleAction}
        {...opts}
        initial={{
          contactId: "", responsibleId: "", title: "", frequencyDays: 30, nextDate: toDateInput(new Date()),
          action: "COTACAO", conditions: "", notes: "", active: true, items: [],
        }}
      />
    </div>
  );
}
