import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Logo } from "@/components/shell/Logo";
import { CircuitBackground } from "@/components/shell/CircuitBackground";
import { PortalLoginForm } from "@/components/portal/PortalLoginForm";

export const metadata = { title: "Portal do cliente | MAX LED" };

export default async function PortalLoginPage({ searchParams }: { searchParams: Promise<{ sessao?: string }> }) {
  const session = await auth();
  const { sessao } = await searchParams;
  if (session?.user?.role === "CUSTOMER" && sessao !== "invalida") redirect("/portal");
  const staff = session?.user && session.user.role !== "CUSTOMER";

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-8 px-6 py-10">
      <CircuitBackground />
      <div className="relative z-10 flex flex-col items-center gap-3 text-center">
        <Logo size={80} withCircuits />
        <h1 className="font-display text-2xl text-ink">
          MAX LED <span className="text-ink-faint">|</span> <span className="text-gold-bright">Portal do cliente</span>
        </h1>
        <p className="max-w-sm text-xs text-ink-muted">
          Acompanhe pedidos, notas fiscais, pagamentos e programações da sua empresa.
        </p>
      </div>
      <div className="relative z-10 flex w-full flex-col items-center gap-4">
        {staff ? (
          <p className="max-w-sm rounded-lg border border-gold-deep/40 bg-surface px-4 py-3 text-center text-xs text-ink-muted">
            Você está conectado como equipe interna. O portal é exclusivo para clientes.{" "}
            <Link href="/" className="font-semibold text-gold-bright hover:underline">
              Voltar ao sistema
            </Link>
          </p>
        ) : (
          <>
            {sessao === "invalida" && (
              <p role="alert" className="max-w-sm text-center text-xs text-critical">
                Sua sessão não é mais válida. Entre novamente.
              </p>
            )}
            <PortalLoginForm />
          </>
        )}
      </div>
      <Link href="/login" className="relative z-10 text-xs text-ink-faint hover:text-ink">
        Acesso da equipe MAX LED
      </Link>
    </main>
  );
}
