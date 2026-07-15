import { requireView } from "@/lib/require-permission";
import { isAiConfigured, listOpenDealsBrief } from "@/lib/ai";
import { InsightsPanel } from "@/components/ia/InsightsPanel";
import { DealAssistPanel } from "@/components/ia/DealAssistPanel";

export default async function IaPage() {
  const session = await requireView("ia");
  const configured = isAiConfigured();
  const deals = configured ? await listOpenDealsBrief(session) : [];

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-[22px] text-ink">Inteligência Artificial</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Sugestões, previsões e alertas — sempre com justificativa baseada nos seus dados reais
        </p>
      </div>

      {!configured && (
        <div className="mb-4 rounded-xl border border-dashed border-gold-deep/50 bg-surface px-6 py-5 text-center">
          <p className="text-sm text-ink-muted">
            IA ainda não configurada. Cadastre a variável <code>ANTHROPIC_API_KEY</code> para
            ativar previsões, alertas, cross-sell e o assistente de redação.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <InsightsPanel disabled={!configured} />
        <DealAssistPanel disabled={!configured} deals={deals} />
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-gold-deep/40 bg-surface px-5 py-4">
        <p className="text-[12px] text-ink-faint">
          Análise de sentimento e melhor horário de contato dependem de histórico real de
          mensagens de WhatsApp/e-mail, que ainda não está integrado (ver roteiro de integração).
          Essas duas capacidades chegam junto com a API do WhatsApp Business.
        </p>
      </div>
    </div>
  );
}
