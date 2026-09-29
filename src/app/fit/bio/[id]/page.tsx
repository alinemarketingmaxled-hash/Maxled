import { notFound } from "next/navigation";
import { loadFitContext } from "@/lib/fit/server";
import { bmi, fatMassKg, leanMassKg } from "@/lib/fit/bio";
import { Card, SectionTitle, TopBar, fmtDate, fmtNum } from "@/components/fit/ui";
import { DeleteBioButton } from "@/components/fit/DeleteButtons";

const SOURCE_LABEL = { manual: "Digitada", laudo: "Foto do laudo", foto: "Foto do corpo" } as const;

export default async function BioDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadFitContext();
  const bio = ctx.bios.find((b) => b.id === id);
  if (!bio) notFound();
  const rows: [string, string][] = [
    ["Peso", `${fmtNum(bio.weightKg)} kg`],
    ["Gordura corporal", bio.bodyFatPct != null ? `${fmtNum(bio.bodyFatPct)}%` : "–"],
    ["Massa de gordura", fatMassKg(bio) != null ? `${fmtNum(fatMassKg(bio))} kg` : "–"],
    ["Massa magra", leanMassKg(bio) != null ? `${fmtNum(leanMassKg(bio))} kg` : "–"],
    ["Massa muscular", bio.muscleMassKg != null ? `${fmtNum(bio.muscleMassKg)} kg` : "–"],
    ["Gordura visceral", fmtNum(bio.visceralFat)],
    ["Água corporal", bio.waterPct != null ? `${fmtNum(bio.waterPct)}%` : "–"],
    ["Massa óssea", bio.boneMassKg != null ? `${fmtNum(bio.boneMassKg)} kg` : "–"],
    ["Metabolismo basal", bio.bmrKcal != null ? `${bio.bmrKcal} kcal` : "–"],
    ["Idade metabólica", bio.metabolicAge != null ? `${bio.metabolicAge} anos` : "–"],
    ["IMC", fmtNum(bmi(bio.weightKg, ctx.answers.heightCm))],
    ["Cintura", bio.waistCm != null ? `${fmtNum(bio.waistCm)} cm` : "–"],
    ["Quadril", bio.hipCm != null ? `${fmtNum(bio.hipCm)} cm` : "–"],
    ["Peito", bio.chestCm != null ? `${fmtNum(bio.chestCm)} cm` : "–"],
    ["Braço", bio.armCm != null ? `${fmtNum(bio.armCm)} cm` : "–"],
    ["Coxa", bio.thighCm != null ? `${fmtNum(bio.thighCm)} cm` : "–"],
  ];
  return (
    <main className="flex flex-col gap-4">
      <TopBar title="Bioimpedância" back="/fit/bio" right={<DeleteBioButton id={bio.id} redirectTo="/fit/bio" />} />
      <div>
        <p className="text-xs text-fit-muted">{SOURCE_LABEL[bio.source]}</p>
        <h1 className="text-2xl font-bold">{fmtDate(bio.measuredAt, { day: "2-digit", month: "long", year: "numeric" })}</h1>
      </div>
      {bio.hasImage ? (
        <a href={`/fit/bio/${bio.id}/imagem`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[28px] bg-fit-card">
          {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked route */}
          <img src={`/fit/bio/${bio.id}/imagem`} alt="Print do laudo" className="max-h-[70vh] w-full object-contain" />
          <p className="p-3 text-center text-xs text-fit-muted">Toque para abrir em tamanho real</p>
        </a>
      ) : (
        <Card>
          <p className="text-sm text-fit-muted">Nenhum print anexado a esta bio.</p>
        </Card>
      )}
      <Card>
        <SectionTitle>Valores</SectionTitle>
        <dl className="divide-y divide-fit-line text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between py-2">
              <dt className="text-fit-muted">{k}</dt>
              <dd className="font-medium tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      {bio.notes && (
        <Card>
          <SectionTitle>Observações</SectionTitle>
          <p className="whitespace-pre-line text-sm text-fit-muted">{bio.notes}</p>
        </Card>
      )}
    </main>
  );
}
