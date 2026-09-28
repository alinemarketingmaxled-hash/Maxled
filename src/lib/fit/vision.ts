import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Leitura por foto indisponível: ANTHROPIC_API_KEY não configurada.");
  client ??= new Anthropic();
  return client;
}

export function isVisionConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const ReportSchema = z.object({
  isBioimpedanceReport: z.boolean(),
  measuredAt: z.string().nullable().describe("Data da medição no formato YYYY-MM-DD, se visível"),
  weightKg: z.number().nullable(),
  bodyFatPct: z.number().nullable(),
  muscleMassKg: z.number().nullable().describe("Massa muscular (esquelética se houver) em kg"),
  leanMassKg: z.number().nullable().describe("Massa magra / livre de gordura em kg"),
  visceralFat: z.number().nullable().describe("Nível/índice de gordura visceral"),
  waterPct: z.number().nullable().describe("Água corporal em %; converter se vier em litros usando o peso"),
  boneMassKg: z.number().nullable(),
  bmrKcal: z.number().nullable().describe("Taxa metabólica basal em kcal"),
  metabolicAge: z.number().nullable(),
  waistCm: z.number().nullable(),
  hipCm: z.number().nullable(),
  confidence: z.enum(["alta", "media", "baixa"]),
  observations: z.string().describe("Observações curtas em português sobre o laudo"),
});

const BodySchema = z.object({
  isBodyPhoto: z.boolean(),
  bodyFatPctLow: z.number().nullable(),
  bodyFatPctHigh: z.number().nullable(),
  muscleDevelopment: z.enum(["baixo", "moderado", "alto", "muito_alto"]).nullable(),
  fatDistribution: z.string().describe("Onde a gordura parece concentrada, em português"),
  strongPoints: z.array(z.string()).describe("Grupos musculares mais desenvolvidos"),
  weakPoints: z.array(z.string()).describe("Grupos musculares que merecem prioridade"),
  observations: z.string().describe("Resumo curto e respeitoso em português"),
});

export type ReportReading = z.infer<typeof ReportSchema>;
export type BodyReading = z.infer<typeof BodySchema>;

function parseDataUrl(dataUrl: string): { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string } {
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) throw new Error("Imagem inválida.");
  return { mediaType: m[1] as "image/jpeg" | "image/png" | "image/webp", data: m[2] };
}

export async function readBioReport(dataUrl: string): Promise<ReportReading> {
  const img = parseDataUrl(dataUrl);
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(ReportSchema) },
    system:
      "Você lê fotos de laudos de bioimpedância (InBody, Tanita, Omron, balanças de farmácia, apps de balança). " +
      "Extraia somente valores visíveis na imagem; use null para o que não aparecer. Não invente números. " +
      "Converta unidades para kg, %, cm e kcal. Se a imagem não for um laudo, marque isBioimpedanceReport=false.",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } },
          { type: "text", text: "Extraia os valores deste laudo de bioimpedância." },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("Não foi possível ler o laudo. Tente uma foto mais nítida ou preencha manualmente.");
  }
  return response.parsed_output;
}

export async function readBodyPhoto(dataUrl: string, context: { sex: "M" | "F"; heightCm: number; weightKg: number }): Promise<BodyReading> {
  const img = parseDataUrl(dataUrl);
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(BodySchema) },
    system:
      "Você é um avaliador físico. A partir de uma foto de corpo (frente, lado ou costas), estime uma FAIXA de percentual de gordura " +
      "comparando com referências visuais conhecidas, e comente distribuição de gordura e desenvolvimento muscular. " +
      "Seja respeitoso e objetivo; não comente aparência além do necessário para o treino. " +
      "Se a imagem não mostrar um corpo, marque isBodyPhoto=false e deixe as estimativas null.",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } },
          {
            type: "text",
            text: `Sexo: ${context.sex === "M" ? "masculino" : "feminino"}. Altura: ${context.heightCm} cm. Peso: ${context.weightKg} kg. Faça a estimativa.`,
          },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("Não foi possível analisar a foto. Tente outra foto, com boa luz e corpo inteiro.");
  }
  return response.parsed_output;
}
