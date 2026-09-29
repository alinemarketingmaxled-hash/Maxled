import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin, type Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyMfaToken } from "@/lib/mfa";
import type { Role } from "@/generated/prisma/client";

const MAX_LOGIN_ATTEMPTS = 7;

/** Thrown instead of returning null so LoginForm can tell a locked account
 * apart from a plain wrong password — result.code carries this string back
 * through signIn({redirect: false}). */
export class AccountLockedError extends CredentialsSignin {
  code = "account_locked";
}

/** Password was correct but the account has MFA enabled and no code was
 * submitted yet — LoginForm reads this code to switch to the "enter your
 * authenticator code" step instead of showing a generic error. */
export class MfaRequiredError extends CredentialsSignin {
  code = "mfa_required";
}

export class MfaInvalidError extends CredentialsSignin {
  code = "mfa_invalid";
}

/** Maxled Fit accounts (FitAccount) sign in through their own provider so a
 * Fit login never becomes a CRM session: the session callback strips
 * `session.user` for them and exposes only `fitAccountId`. */
const fitCredentials = Credentials({
  id: "fit",
  name: "Maxled Fit",
  credentials: {
    email: { label: "E-mail", type: "email" },
    password: { label: "Senha", type: "password" },
  },
  async authorize(credentials) {
    const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
    const password = credentials?.password;
    if (!email || typeof password !== "string") return null;

    const account = await prisma.fitAccount.findUnique({ where: { email } });
    if (!account?.passwordHash) return null;
    if (account.lockedAt) throw new AccountLockedError();

    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) {
      const attempts = account.failedLoginAttempts + 1;
      await prisma.fitAccount.update({
        where: { id: account.id },
        data: attempts >= MAX_LOGIN_ATTEMPTS ? { failedLoginAttempts: attempts, lockedAt: new Date() } : { failedLoginAttempts: attempts },
      });
      if (attempts >= MAX_LOGIN_ATTEMPTS) throw new AccountLockedError();
      return null;
    }
    if (account.failedLoginAttempts > 0) {
      await prisma.fitAccount.update({ where: { id: account.id }, data: { failedLoginAttempts: 0 } });
    }
    return { id: account.id, name: account.name, email: account.email, kind: "fit" as const };
  },
});

const nextAuth = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    fitCredentials,
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
        code: { label: "Código de verificação", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        const code = typeof credentials?.code === "string" ? credentials.code.trim() : "";
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

        if (user.mfaEnabled && user.mfaSecret) {
          if (!code) throw new MfaRequiredError();
          if (!verifyMfaToken(user.mfaSecret, code, user.email)) throw new MfaInvalidError();
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
        if ((user as { kind?: string }).kind === "fit") {
          token.kind = "fit";
          token.fitAccountId = user.id as string;
          delete token.role;
          delete token.id;
        } else {
          token.kind = "crm";
          token.role = (user as { role: Role }).role;
          token.id = user.id as string;
          delete token.fitAccountId;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (token.kind === "fit") {
        // No CRM identity at all: every CRM check (`session?.user`) fails.
        return { expires: session.expires, fitAccountId: token.fitAccountId } as unknown as typeof session;
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
});

export const { handlers, signIn, signOut } = nextAuth;

/** Raw session, including Maxled Fit logins (`fitAccountId`). Only the Fit
 * module should read this — see src/lib/fit/account.ts. */
export async function fitAuth(): Promise<Session | null> {
  return nextAuth.auth();
}

/** CRM session. A Maxled Fit login is not a CRM identity: Auth.js still
 * attaches a partial `user` to its session, so it is filtered out here —
 * every CRM page and action goes through this function. */
export async function auth(): Promise<Session | null> {
  const session = await nextAuth.auth();
  if (!session || session.fitAccountId || !session.user?.id || !session.user.role) return null;
  return session;
}
