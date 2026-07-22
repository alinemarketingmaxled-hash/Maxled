import { requireView } from "@/lib/require-permission";
import { isAiConfigured, listOpenDealsBrief } from "@/lib/ai";
import { InsightsPanel } from "@/components/ia/InsightsPanel";
import { DealAssistPanel } from "@/components/ia/DealAssistPanel";

export default async function IaPage() {
  const session = await requireView("ia");
  const deals = await listOpenDealsBrief(session);

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-[22px] text-ink">Inteligência Artificial</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Sugestões, previsões e alertas — sempre com justificativa baseada nos seus dados reais
        </p>
      </div>

      {!isAiConfigured() && (
        <div className="mb-4 rounded-xl border border-dashed border-gold-deep/50 bg-surface px-6 py-5 text-center">
          <p className="text-sm text-ink-muted">
            A IA real (Claude) ainda não está ativa nesta conta. Enquanto isso, as ferramentas
            abaixo funcionam em <strong>modo automático</strong> — cálculos e sugestões a partir
            dos seus dados reais, sem custo, sinalizados como &quot;análise automática&quot;.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <InsightsPanel />
        <DealAssistPanel deals={deals} />
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
