import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-ground px-6">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-gold-bright via-gold to-gold-deep font-display text-2xl text-black">
          M
        </div>
        <h1 className="font-display text-2xl text-ink">
          Maxled <span className="text-gold-bright">CRM</span>
        </h1>
      </div>
      <LoginForm />
    </main>
  );
}
