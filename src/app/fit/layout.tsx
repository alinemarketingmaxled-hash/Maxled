import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { FitNav } from "@/components/fit/FitNav";

export const metadata: Metadata = {
  title: "Maxled Fit",
  description: "Treino personalizado pelo seu objetivo, equipamentos e bioimpedância.",
};

export const viewport: Viewport = {
  themeColor: "#111214",
  width: "device-width",
  initialScale: 1,
};

export default async function FitLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("fit-theme")?.value === "light" ? "light" : "dark";
  return (
    <div className="fit min-h-screen w-full" data-fit-theme={theme}>
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-32">{children}</div>
      <FitNav />
    </div>
  );
}
