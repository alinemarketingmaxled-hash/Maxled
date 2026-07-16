import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/client";

const MAX_LOGIN_ATTEMPTS = 7;

/** Thrown instead of returning null so LoginForm can tell a locked account
 * apart from a plain wrong password — result.code carries this string back
 * through signIn({redirect: false}). */
export class AccountLockedError extends CredentialsSignin {
  code = "account_locked";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.deletedAt) return null;

        // Rejected before checking the password: once locked, only the
        // mediador can clear it (Perfil → vendedor → Desbloquear acesso),
        // so further attempts shouldn't even get to guess the password.
        if (user.lockedAt) throw new AccountLockedError();

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          await prisma.user.update({
            where: { id: user.id },
            data:
              attempts >= MAX_LOGIN_ATTEMPTS
                ? { failedLoginAttempts: attempts, lockedAt: new Date() }
                : { failedLoginAttempts: attempts },
          });
          if (attempts >= MAX_LOGIN_ATTEMPTS) throw new AccountLockedError();
          return null;
        }

        if (user.failedLoginAttempts > 0) {
          await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0 } });
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: Role }).role;
        token.id = user.id as string;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
});
