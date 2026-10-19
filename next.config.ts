import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Clientes IMAP/SMTP do módulo de E-mails (Node puro, com dependências
  // nativas de stream) ficam fora do bundle do servidor.
  serverExternalPackages: ["imapflow", "mailparser", "nodemailer"],
  experimental: {
    // Anexos de e-mail passam por server action; a Vercel recusa corpos
    // acima de ~4,5MB, então o limite fica alinhado a isso.
    serverActions: {
      bodySizeLimit: "4.5mb",
    },
    // Default is 0s for dynamic routes (every one of ours, since they all
    // read the session) — so switching between sidebar pages and back
    // always paid a full server round-trip, even seconds later. 30s lets
    // the client reuse what it just fetched for quick back-and-forth
    // navigation. Mutations still show fresh data immediately: every
    // create/update/delete action in this app already calls
    // router.refresh(), which invalidates this cache for the current route
    // regardless of staleTimes.
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
