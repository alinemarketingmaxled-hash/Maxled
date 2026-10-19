# Maxled CRM + ERP

Gold-and-black CRM for Maxled's sales team, extended into the **MAX LED ERP**
(multiempresa: pedidos, estoque, kits, expedição, compras/importação, fiscal,
financeiro, Mercado Livre, e-mails, portal do cliente, relatórios). CRM spec at
[`docs/CRM-SPEC.md`](docs/CRM-SPEC.md); ERP architecture, permissions, business
rules, integrations and backup/restore procedure at [`docs/ERP.md`](docs/ERP.md);
a static visual mockup of the design system at
[`design/dashboard-mockup.html`](design/dashboard-mockup.html).

Stack: Next.js (App Router, TypeScript), Tailwind CSS v4, Prisma 7 +
PostgreSQL, NextAuth.

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Have a PostgreSQL database available and copy `.env.example` to `.env`
   with its connection string:
   ```bash
   cp .env.example .env
   # edit .env — set DATABASE_URL, AUTH_SECRET
   ```
3. Apply the schema:
   ```bash
   npx prisma migrate dev
   ```
4. (Optional) Load development/homologation data — test companies, products,
   a kit and one user per ERP profile (password `maxled123`):
   ```bash
   npx prisma db seed
   npm run erp:selftest   # end-to-end check of the ERP core rules
   ```
5. Run the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Deploying

The app is a standard Next.js project — it deploys to Vercel (or any
Node host) by connecting this repository and setting `DATABASE_URL` /
`AUTH_SECRET` as environment variables. A free managed Postgres instance
(e.g. Neon or Supabase) works as the production database; point
`DATABASE_URL` at it and run `npx prisma migrate deploy` once.

Dark/light appearance is per-account, not a build-time setting — each user
switches it under **Perfil → Aparência** once logged in.
