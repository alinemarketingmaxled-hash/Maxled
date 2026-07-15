import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/LoginForm";
import { Logo } from "@/components/shell/Logo";
import { CircuitBackground } from "@/components/shell/CircuitBackground";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-8 px-6">
      <CircuitBackground />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <Logo size={96} withCircuits />
        <h1 className="font-display text-2xl text-ink">
          Maxled <span className="text-gold-bright">CRM</span>
        </h1>
      </div>
      <div className="relative z-10">
        <LoginForm />
      </div>
    </main>
  );
}
