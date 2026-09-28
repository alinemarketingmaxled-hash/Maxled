import { getFitProfile, requireFitUser } from "@/lib/fit/server";
import { OnboardingWizard } from "@/components/fit/OnboardingWizard";

export default async function ComecarPage() {
  const user = await requireFitUser();
  const profile = await getFitProfile(user.id);
  return <OnboardingWizard initial={profile?.answers ?? null} editing={!!profile} defaultName={user.name ?? ""} />;
}
