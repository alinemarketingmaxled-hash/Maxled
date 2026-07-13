import type { Metadata } from "next";
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
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
