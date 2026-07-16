import type { Metadata } from "next";
import Script from "next/script";
import { Providers } from "@/components/Providers";
import { APPEARANCE_INIT_SCRIPT } from "@/components/shell/appearance-storage";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maxled CRM",
  description: "CRM gold-and-black da Maxled — vendas, negócios, agenda e analítica.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Reads the saved tema/tamanho-da-letra before first paint so the
            page never flashes the dark default before switching. */}
        <Script id="appearance-init" strategy="beforeInteractive">
          {APPEARANCE_INIT_SCRIPT}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
