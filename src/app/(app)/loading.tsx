/**
 * Loading padrão do app — skeleton leve enquanto a página server-side carrega.
 * Preserva a identidade visual (fundo bg, cards com borda soft).
 */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[12px] bg-surface border border-soft animate-pulse" />
        <div className="flex flex-col gap-1.5">
          <div className="h-5 w-52 rounded-md bg-surface border border-soft animate-pulse" />
          <div className="h-3 w-72 max-w-full rounded-md bg-surface/70 animate-pulse" />
        </div>
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white border border-soft p-5 h-28 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
