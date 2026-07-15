import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import type { Role } from "@/generated/prisma/client";

export async function listVendors() {
  return prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function getVendor(id: string) {
  return prisma.user.findFirst({ where: { id, deletedAt: null } });
}

export type VendorInput = {
  name: string;
  email: string;
  role: Role;
  jobTitle?: string | null;
  birthday?: Date | null;
  goal1?: number | null;
  goal2?: number | null;
  commissionPct1?: number | null;
  commissionPct2?: number | null;
  password?: string;
};

export async function createVendor(actorId: string, input: VendorInput) {
  if (!input.password) throw new Error("Senha é obrigatória para novos vendedores.");
  const passwordHash = await bcrypt.hash(input.password, 10);

  const vendor = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      role: input.role,
      jobTitle: input.jobTitle,
      birthday: input.birthday,
      goal1: input.goal1,
      goal2: input.goal2,
      commissionPct1: input.commissionPct1,
      commissionPct2: input.commissionPct2,
      passwordHash,
    },
  });

  await logActivity({ actorId, entityType: "User", entityId: vendor.id, action: "created" });
  return vendor;
}

export async function updateVendor(actorId: string, id: string, input: VendorInput) {
  const data: Record<string, unknown> = {
    name: input.name,
    email: input.email,
    role: input.role,
    jobTitle: input.jobTitle,
    birthday: input.birthday,
    goal1: input.goal1,
    goal2: input.goal2,
    commissionPct1: input.commissionPct1,
    commissionPct2: input.commissionPct2,
  };
  if (input.password) {
    data.passwordHash = await bcrypt.hash(input.password, 10);
  }

  const vendor = await prisma.user.update({ where: { id }, data });
  await logActivity({ actorId, entityType: "User", entityId: vendor.id, action: "updated" });
  return vendor;
}

export async function deactivateVendor(actorId: string, id: string) {
  const vendor = await prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
  await logActivity({ actorId, entityType: "User", entityId: vendor.id, action: "deleted" });
  return vendor;
}

export type OwnProfileInput = {
  name: string;
  jobTitle?: string | null;
  avatarUrl?: string | null;
  password?: string;
};

/** Self-service edit: any authenticated user can update their own display
 * name, photo and job title. Role, goals and commission stay mediator-only
 * (set via lib/users.ts updateVendor). */
export async function updateOwnProfile(userId: string, input: OwnProfileInput) {
  const data: Record<string, unknown> = {
    name: input.name,
    jobTitle: input.jobTitle,
    avatarUrl: input.avatarUrl,
  };
  if (input.password) {
    data.passwordHash = await bcrypt.hash(input.password, 10);
  }

  const user = await prisma.user.update({ where: { id: userId }, data });
  await logActivity({ actorId: userId, entityType: "User", entityId: userId, action: "updated" });
  return user;
}

/** Feeds the birthday congratulatory message (spec §3.7/§5) — the send itself
 * lives in Rede Social + WhatsApp integration once those modules exist. */
export async function getTodaysBirthdays() {
  const today = new Date();
  const vendors = await prisma.user.findMany({ where: { deletedAt: null, birthday: { not: null } } });
  return vendors.filter(
    (v) =>
      v.birthday &&
      v.birthday.getMonth() === today.getMonth() &&
      v.birthday.getDate() === today.getDate(),
  );
}
