import { redirect } from "next/navigation";
import { currentFitAccount } from "@/lib/fit/account";
import { FitAuthForm } from "@/components/fit/FitAuthForm";

export default async function Page() {
  if (await currentFitAccount()) redirect("/fit");
  return <FitAuthForm mode="cadastro" />;
}
