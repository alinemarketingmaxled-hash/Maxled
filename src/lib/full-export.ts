import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * System-wide export across every owner — not scoped to a session, since
 * this backs the scheduled OneDrive sync (an internal automation, not a
 * user-facing screen). Three separate row sets (cadastro / prospecção /
 * negociação) rather than one mega-join: each entity has a different shape
 * and forcing them into one flat table would mean mostly-empty columns.
 */
export async function getFullExportData() {
  const [contacts, prospects, deals] = await Promise.all([
    prisma.contact.findMany({
      where: { deletedAt: null },
      include: { owner: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.prospect.findMany({
      where: { deletedAt: null },
      include: {
        owner: { select: { name: true } },
        currentStage: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.deal.findMany({
      where: { deletedAt: null },
      include: {
        owner: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true, accountName: true } },
        stage: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    clientes: contacts.map((c) => ({
      proprietario: c.owner.name,
      tipoPessoa: c.personType ?? "",
      nome: c.firstName,
      sobrenome: c.lastName,
      empresa: c.accountName ?? "",
      cnpj: c.cnpj ?? "",
      email: c.email ?? "",
      telefone: c.phone ?? "",
      celular: c.mobile ?? "",
      telefoneResidencial: c.residentialPhone ?? "",
      telefoneAssistente: c.assistantPhone ?? "",
      origemLead: c.leadSource ?? "",
      fornecedor: c.supplierName ?? "",
      perfil: c.profile ?? "",
      cargo: c.jobTitle ?? "",
      departamento: c.department ?? "",
      rua: c.street ?? "",
      numero: c.number ?? "",
      cidade: c.city ?? "",
      estado: c.state ?? "",
      cep: c.postalCode ?? "",
      inscricaoEstadual: c.inscricaoEstadual ?? "",
      emailFinanceiro: c.emailFinanceiro ?? "",
      emailNfe: c.emailNfe ?? "",
      enderecoEntrega: c.enderecoEntrega ?? "",
      aniversario: c.birthday ? c.birthday.toISOString().slice(0, 10) : "",
      potencialComercial: c.commercialPotential ?? "",
      statusCrm: c.crmStatus ?? "",
      ultimoContato: c.lastContactedAt ? c.lastContactedAt.toISOString().slice(0, 10) : "",
      proximoContato: c.nextContactAt ? c.nextContactAt.toISOString().slice(0, 10) : "",
      observacoes: c.notes ?? "",
      criadoEm: c.createdAt.toISOString().slice(0, 10),
    })),
    prospeccoes: prospects.map((p) => ({
      proprietario: p.owner.name,
      nomeProspect: p.name,
      clienteEmpresa: p.clientName,
      telefone: p.phone ?? "",
      email: p.email ?? "",
      temperatura: p.temperature,
      perfil: p.profile,
      etapaAtual: p.currentStage.name,
      dataContato: p.contactDate.toISOString().slice(0, 10),
      ultimoToque: p.lastTouchedAt.toISOString().slice(0, 10),
      convertidoEmCliente: p.convertedContactId ? "Sim" : "Não",
      convertidoEm: p.convertedAt ? p.convertedAt.toISOString().slice(0, 10) : "",
      observacoes: p.notes ?? "",
      criadoEm: p.createdAt.toISOString().slice(0, 10),
    })),
    negociacoes: deals.map((d) => ({
      proprietario: d.owner.name,
      cliente: d.contact.accountName || `${d.contact.firstName} ${d.contact.lastName}`,
      nomeNegocio: d.name,
      valor: Number(d.value),
      etapa: d.stage.name,
      statusPagamento: d.paymentStatus,
      formaPagamento: d.paymentMethod ?? "",
      aCaminhoDesde: d.onTheWaySince ? d.onTheWaySince.toISOString().slice(0, 10) : "",
      prazoACaminho: d.onTheWayDeadline ? d.onTheWayDeadline.toISOString().slice(0, 10) : "",
      criadoEm: d.createdAt.toISOString().slice(0, 10),
      atualizadoEm: d.updatedAt.toISOString().slice(0, 10),
    })),
  };
}

export type FullExportData = Awaited<ReturnType<typeof getFullExportData>>;
