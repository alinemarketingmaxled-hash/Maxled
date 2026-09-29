import type { Role } from "@/generated/prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    /** Set only for Maxled Fit logins (which carry no `user`). */
    fitAccountId?: string;
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    kind?: "crm" | "fit";
    fitAccountId?: string;
  }
}
