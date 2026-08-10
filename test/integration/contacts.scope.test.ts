// Integration test: exercises lib/contacts.ts against a real Postgres
// database (the same one `npm run dev` uses locally) to prove RBAC scope
// isolation actually holds at the query layer, not just in the
// permissions matrix. Run with `npm run test:integration` — requires a
// reachable DATABASE_URL (see README.md for local Postgres setup).
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { createContact, listContacts } from "@/lib/contacts";

function sessionFor(userId: string, role: "SELLER" | "MEDIATOR"): Session {
  return {
    user: { id: userId, role, email: `${userId}@test.local`, name: "Test" },
    expires: new Date(Date.now() + 60_000).toISOString(),
  } as Session;
}

const runId = `itest-${Date.now()}`;
let sellerAId: string;
let sellerBId: string;
let mediatorId: string;
let contactId: string;

beforeAll(async () => {
  const [sellerA, sellerB, mediator] = await Promise.all([
    prisma.user.create({
      data: { name: "Seller A", email: `${runId}-a@test.local`, passwordHash: "x", role: "SELLER" },
    }),
    prisma.user.create({
      data: { name: "Seller B", email: `${runId}-b@test.local`, passwordHash: "x", role: "SELLER" },
    }),
    prisma.user.create({
      data: { name: "Mediator", email: `${runId}-m@test.local`, passwordHash: "x", role: "MEDIATOR" },
    }),
  ]);
  sellerAId = sellerA.id;
  sellerBId = sellerB.id;
  mediatorId = mediator.id;

  const contact = await createContact(sessionFor(sellerAId, "SELLER"), {
    ownerId: sellerAId,
    firstName: "Cliente",
    lastName: "De Teste",
  });
  contactId = contact.id;
});

afterAll(async () => {
  await prisma.activityLog.deleteMany({ where: { contactId } });
  await prisma.contact.deleteMany({ where: { id: contactId } });
  await prisma.user.deleteMany({ where: { id: { in: [sellerAId, sellerBId, mediatorId] } } });
});

describe("Clientes RBAC scope (own vs all), enforced at the query layer", () => {
  it("the owning seller sees their own contact", async () => {
    const contacts = await listContacts(sessionFor(sellerAId, "SELLER"));
    expect(contacts.map((c) => c.id)).toContain(contactId);
  });

  it("a different seller does NOT see another seller's contact", async () => {
    const contacts = await listContacts(sessionFor(sellerBId, "SELLER"));
    expect(contacts.map((c) => c.id)).not.toContain(contactId);
  });

  it("the mediator sees every seller's contact", async () => {
    const contacts = await listContacts(sessionFor(mediatorId, "MEDIATOR"));
    expect(contacts.map((c) => c.id)).toContain(contactId);
  });

  it("createContact logs the activity under the correct actor", async () => {
    const log = await prisma.activityLog.findFirst({ where: { contactId }, orderBy: { createdAt: "desc" } });
    expect(log?.actorId).toBe(sellerAId);
    expect(log?.action).toBe("created");
  });
});
