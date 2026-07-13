import { signOutAction } from "@/lib/auth-actions";

export function LogoutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="rounded-lg border border-gold-deep px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-gold"
      >
        Sair
      </button>
    </form>
  );
}
