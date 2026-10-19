import type { Role } from "@/generated/prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      /** Só nas sessões do Portal do cliente (role CUSTOMER). */
      contactId?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
    contactId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    contactId?: string;
  }
}
