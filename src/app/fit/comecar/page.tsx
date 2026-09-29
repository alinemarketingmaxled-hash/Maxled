import { getFitProfile, requireFitAccount } from "@/lib/fit/server";
import { OnboardingWizard } from "@/components/fit/OnboardingWizard";

export default async function ComecarPage({ searchParams }: { searchParams: Promise<{ etapa?: string }> }) {
  const { etapa } = await searchParams;
  const account = await requireFitAccount();
  const profile = await getFitProfile(account.id);
  return <OnboardingWizard initial={profile?.answers ?? null} editing={!!profile} defaultName={account.name} startAt={profile && (etapa === "foco" || etapa === "mobilidade") ? etapa : undefined} />;
}
