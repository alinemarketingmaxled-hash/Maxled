import { loadFitContext } from "@/lib/fit/server";
import { isVisionConfigured } from "@/lib/fit/vision";
import { BioForm } from "@/components/fit/BioForm";
import { TopBar } from "@/components/fit/ui";

export default async function NovaBioPage({ searchParams }: { searchParams: Promise<{ modo?: string; primeira?: string }> }) {
  const { modo, primeira } = await searchParams;
  const ctx = await loadFitContext();
  const mode = modo === "foto" || modo === "manual" ? modo : "laudo";
  return (
    <main className="flex flex-col gap-2">
      <TopBar title="Nova bioimpedância" back="/fit/bio" />
      <BioForm
        initialMode={mode}
        lastWeight={ctx.analysis.latest?.weightKg ?? ctx.answers.weightKg}
        visionEnabled={isVisionConfigured()}
        first={primeira === "1" || ctx.bios.length === 0}
      />
    </main>
  );
}
