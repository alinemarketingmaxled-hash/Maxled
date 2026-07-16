import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canView } from "@/lib/permissions";
import { listContacts } from "@/lib/contacts";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await auth();
  if (!session?.user || !canView(session.user.role, "vendas")) {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  const contacts = await listContacts(session);
  const csv = toCsv(
    contacts.map((c) => ({
      ownerEmail: c.owner?.email ?? "",
      personType: c.personType,
      firstName: c.firstName,
      lastName: c.lastName,
      accountName: c.accountName,
      cnpj: c.cnpj,
      email: c.email,
      phone: c.phone,
      mobile: c.mobile,
      residentialPhone: c.residentialPhone,
      assistantPhone: c.assistantPhone,
      leadSource: c.leadSource,
      supplierName: c.supplierName,
      jobTitle: c.jobTitle,
      department: c.department,
      street: c.street,
      number: c.number,
      city: c.city,
      state: c.state,
      postalCode: c.postalCode,
      latitude: c.latitude,
      longitude: c.longitude,
      birthday: c.birthday ? c.birthday.toLocaleDateString("pt-BR") : "",
      commercialPotential: c.commercialPotential,
      crmStatus: c.crmStatus,
      nextContactAt: c.nextContactAt ? c.nextContactAt.toLocaleDateString("pt-BR") : "",
      notes: c.notes,
    })),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="maxled-vendas-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
