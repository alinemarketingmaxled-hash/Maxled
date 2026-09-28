"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { addBioAction, scanBioReportAction, scanBodyPhotoAction } from "@/app/fit/actions";
import { resizeImageToDataUrl } from "@/lib/resize-image";
import type { BioInput } from "@/lib/fit/types";
import type { BodyReading } from "@/lib/fit/vision";
import { CameraI, CheckI, FileI, PencilI, SparkI, UserI } from "./FitIcons";

type Mode = "laudo" | "foto" | "manual";

type Fields = Record<
  | "weightKg"
  | "bodyFatPct"
  | "muscleMassKg"
  | "leanMassKg"
  | "visceralFat"
  | "waterPct"
  | "boneMassKg"
  | "bmrKcal"
  | "metabolicAge"
  | "waistCm"
  | "hipCm"
  | "chestCm"
  | "armCm"
  | "thighCm",
  string
>;

const EMPTY: Fields = {
  weightKg: "",
  bodyFatPct: "",
  muscleMassKg: "",
  leanMassKg: "",
  visceralFat: "",
  waterPct: "",
  boneMassKg: "",
  bmrKcal: "",
  metabolicAge: "",
  waistCm: "",
  hipCm: "",
  chestCm: "",
  armCm: "",
  thighCm: "",
};

const MAIN: { key: keyof Fields; label: string; unit: string }[] = [
  { key: "weightKg", label: "Peso", unit: "kg" },
  { key: "bodyFatPct", label: "Gordura corporal", unit: "%" },
  { key: "muscleMassKg", label: "Massa muscular", unit: "kg" },
  { key: "leanMassKg", label: "Massa magra", unit: "kg" },
  { key: "visceralFat", label: "Gordura visceral", unit: "nível" },
  { key: "waterPct", label: "Água corporal", unit: "%" },
  { key: "boneMassKg", label: "Massa óssea", unit: "kg" },
  { key: "bmrKcal", label: "Metabolismo basal", unit: "kcal" },
  { key: "metabolicAge", label: "Idade metabólica", unit: "anos" },
];

const MEASURES: { key: keyof Fields; label: string }[] = [
  { key: "waistCm", label: "Cintura" },
  { key: "hipCm", label: "Quadril" },
  { key: "chestCm", label: "Peito" },
  { key: "armCm", label: "Braço" },
  { key: "thighCm", label: "Coxa" },
];

function todayInput(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function BioForm({ initialMode, lastWeight, visionEnabled, first }: { initialMode: Mode; lastWeight: number; visionEnabled: boolean; first: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [fields, setFields] = useState<Fields>({ ...EMPTY, weightKg: String(lastWeight) });
  const [date, setDate] = useState(todayInput);
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [body, setBody] = useState<BodyReading | null>(null);
  const [filled, setFilled] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [scanning, startScan] = useTransition();
  const [saving, startSave] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof Fields, v: string) => setFields((f) => ({ ...f, [k]: v }));

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setScanMsg(null);
    setBody(null);
    try {
      const url = await resizeImageToDataUrl(file, 1400, 0.82);
      setPreview(url);
      if (!visionEnabled) {
        setScanMsg("Leitura automática indisponível no servidor. Preencha os valores manualmente abaixo.");
        return;
      }
      startScan(async () => {
        if (mode === "laudo") {
          const res = await scanBioReportAction(url);
          if (!res.ok) return setError(res.error);
          const r = res.data;
          if (!r.isBioimpedanceReport) {
            setError("Essa foto não parece um laudo de bioimpedância. Tente de novo com o laudo inteiro e bem iluminado.");
            return;
          }
          const next: Partial<Fields> = {};
          const got = new Set<string>();
          for (const k of Object.keys(EMPTY) as (keyof Fields)[]) {
            const v = (r as Record<string, unknown>)[k];
            if (typeof v === "number") {
              next[k] = String(Math.round(v * 10) / 10);
              got.add(k);
            }
          }
          setFields((f) => ({ ...f, ...next }));
          setFilled(got);
          if (r.measuredAt && /^\d{4}-\d{2}-\d{2}$/.test(r.measuredAt)) setDate(r.measuredAt);
          setScanMsg(
            `${got.size} valores lidos (confiança ${r.confidence}). Confira antes de salvar.${r.observations ? ` ${r.observations}` : ""}`,
          );
        } else {
          const res = await scanBodyPhotoAction(url);
          if (!res.ok) return setError(res.error);
          const r = res.data;
          if (!r.isBodyPhoto || r.bodyFatPctLow == null || r.bodyFatPctHigh == null) {
            setError("Não consegui ver o corpo nessa foto. Use uma foto de corpo inteiro, com roupa justa e boa luz.");
            return;
          }
          setBody(r);
          set("bodyFatPct", String(Math.round(((r.bodyFatPctLow + r.bodyFatPctHigh) / 2) * 10) / 10));
          setFilled(new Set(["bodyFatPct"]));
          setScanMsg(`Estimativa visual: ${r.bodyFatPctLow}–${r.bodyFatPctHigh}% de gordura. Usei o meio da faixa; ajuste se quiser.`);
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível ler a imagem.");
    }
  }

  function save() {
    setError(null);
    const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
    const weight = num(fields.weightKg);
    if (!weight) {
      setError("Informe o peso.");
      return;
    }
    const bodyNote = body
      ? `Foto: ${body.observations} Pontos fortes: ${body.strongPoints.join(", ") || "–"}. Prioridades: ${body.weakPoints.join(", ") || "–"}.`
      : "";
    const input: BioInput = {
      measuredAt: new Date(`${date}T12:00:00-03:00`).toISOString(),
      source: mode,
      weightKg: weight,
      bodyFatPct: num(fields.bodyFatPct),
      muscleMassKg: num(fields.muscleMassKg),
      leanMassKg: num(fields.leanMassKg),
      visceralFat: num(fields.visceralFat),
      waterPct: num(fields.waterPct),
      boneMassKg: num(fields.boneMassKg),
      bmrKcal: num(fields.bmrKcal) != null ? Math.round(num(fields.bmrKcal)!) : null,
      metabolicAge: num(fields.metabolicAge) != null ? Math.round(num(fields.metabolicAge)!) : null,
      waistCm: num(fields.waistCm),
      hipCm: num(fields.hipCm),
      chestCm: num(fields.chestCm),
      armCm: num(fields.armCm),
      thighCm: num(fields.thighCm),
      notes: [notes.trim(), bodyNote].filter(Boolean).join("\n").slice(0, 1000) || null,
    };
    if (Object.entries(input).some(([k, v]) => typeof v === "number" && Number.isNaN(v) && k !== "measuredAt")) {
      setError("Há um número inválido no formulário.");
      return;
    }
    startSave(async () => {
      const res = await addBioAction(input);
      if (!res.ok) return setError(res.error);
      router.push("/fit/bio?atualizado=1");
      router.refresh();
    });
  }

  const modes: { key: Mode; label: string; icon: typeof CameraI }[] = [
    { key: "laudo", label: "Foto do laudo", icon: FileI },
    { key: "foto", label: "Foto do corpo", icon: UserI },
    { key: "manual", label: "Manual", icon: PencilI },
  ];

  return (
    <div className="flex flex-col gap-4">
      {first && (
        <div className="rounded-[28px] bg-fit-lime p-5 text-fit-on-lime">
          <p className="text-lg font-bold">Seu ponto de partida</p>
          <p className="text-sm opacity-75">Com a primeira bio, o app calcula metabolismo, metas e começa a ajustar o treino a cada nova medição.</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 rounded-full bg-fit-card p-1">
        {modes.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => {
              setMode(m.key);
              setPreview(null);
              setScanMsg(null);
              setBody(null);
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-medium ${mode === m.key ? "bg-fit-lime text-fit-on-lime" : "text-fit-muted"}`}
          >
            <m.icon className="h-4 w-4" />
            {m.label}
          </button>
        ))}
      </div>

      {mode !== "manual" && (
        <div className="rounded-[28px] bg-fit-card p-5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture={mode === "laudo" ? "environment" : undefined}
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
            <img src={preview} alt="Foto enviada" className="max-h-72 w-full rounded-3xl object-contain" />
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-fit-card-3 py-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-fit-lime text-fit-on-lime">
                <CameraI className="h-6 w-6" />
              </span>
              <span className="text-sm font-semibold">{mode === "laudo" ? "Fotografar ou enviar o laudo" : "Enviar foto do corpo"}</span>
              <span className="max-w-xs text-xs text-fit-muted">
                {mode === "laudo"
                  ? "InBody, Tanita, balança de farmácia ou print do app da balança. A IA lê os números."
                  : "De frente, corpo inteiro, roupa justa e boa luz. A IA estima o % de gordura. A foto não é salva."}
              </span>
            </button>
          )}
          {preview && (
            <button type="button" onClick={() => fileRef.current?.click()} className="mt-3 w-full rounded-full bg-fit-card-2 py-2.5 text-xs font-medium">
              Trocar foto
            </button>
          )}
          {scanning && (
            <p className="mt-3 flex items-center gap-2 rounded-2xl bg-fit-lime-soft p-3 text-sm">
              <SparkI className="h-4 w-4 animate-spin text-fit-accent" /> Analisando a imagem...
            </p>
          )}
          {scanMsg && !scanning && <p className="mt-3 rounded-2xl bg-fit-lime-soft p-3 text-sm">{scanMsg}</p>}
          {body && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-2xl bg-fit-card-2 p-3">
                <p className="text-fit-muted">Pontos fortes</p>
                <p className="mt-1 font-medium">{body.strongPoints.join(", ") || "–"}</p>
              </div>
              <div className="rounded-2xl bg-fit-card-2 p-3">
                <p className="text-fit-muted">Prioridades</p>
                <p className="mt-1 font-medium">{body.weakPoints.join(", ") || "–"}</p>
              </div>
              <p className="col-span-2 text-fit-muted">{body.fatDistribution}</p>
            </div>
          )}
        </div>
      )}

      <div className="rounded-[28px] bg-fit-card p-5">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-fit-muted">Data da medição</span>
          <input type="date" value={date} max={todayInput()} onChange={(e) => setDate(e.target.value)} className="rounded-xl bg-fit-card-2 px-3 py-2 text-sm outline-none" />
        </label>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {MAIN.map((f) => (
            <Field key={f.key} label={f.label} unit={f.unit} value={fields[f.key]} onChange={(v) => set(f.key, v)} highlight={filled.has(f.key)} required={f.key === "weightKg"} />
          ))}
        </div>
        <p className="mb-2 mt-5 text-xs font-medium text-fit-muted">Medidas (cm), opcional</p>
        <div className="grid grid-cols-3 gap-2">
          {MEASURES.map((f) => (
            <Field key={f.key} label={f.label} unit="cm" value={fields[f.key]} onChange={(v) => set(f.key, v)} highlight={filled.has(f.key)} />
          ))}
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Observações (em jejum? após treino? mesma balança?)"
          className="mt-4 w-full rounded-2xl bg-fit-card-2 p-3 text-sm outline-none ring-fit-lime focus:ring-2"
        />
        <p className="mt-2 text-[11px] text-fit-faint">Dica: meça sempre em jejum, de manhã, na mesma balança, a cada 3-4 semanas.</p>
      </div>

      {error && <p className="rounded-2xl bg-fit-bad/15 p-3 text-sm text-fit-bad">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={saving || scanning}
        className="flex h-14 items-center justify-center gap-2 rounded-full bg-fit-lime text-base font-semibold text-fit-on-lime disabled:opacity-50"
      >
        <CheckI className="h-5 w-5" strokeWidth={3} /> {saving ? "Salvando..." : "Salvar e ajustar treino"}
      </button>
    </div>
  );
}

function Field({
  label,
  unit,
  value,
  onChange,
  highlight,
  required,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  highlight?: boolean;
  required?: boolean;
}) {
  return (
    <label className={`block rounded-2xl p-3 ${highlight ? "bg-fit-lime-soft ring-1 ring-fit-lime" : "bg-fit-card-2"}`}>
      <span className="block text-[11px] text-fit-muted">
        {label}
        {required && " *"}
      </span>
      <span className="flex items-baseline gap-1">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
          placeholder="–"
          className="w-full min-w-0 bg-transparent text-lg font-bold tabular-nums outline-none"
        />
        <span className="text-[10px] text-fit-muted">{unit}</span>
      </span>
    </label>
  );
}
