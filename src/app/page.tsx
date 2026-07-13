export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-ground px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-gold-bright via-gold to-gold-deep font-display text-2xl text-black">
        M
      </div>
      <h1 className="font-display text-3xl text-ink">
        Maxled <span className="text-gold-bright">CRM</span>
      </h1>
      <p className="max-w-md text-sm text-ink-muted">
        Fundação do projeto em construção — autenticação e módulos chegando a
        seguir.
      </p>
    </main>
  );
}
