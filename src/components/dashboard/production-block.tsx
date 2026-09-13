import type { ProductionItem } from "@/lib/dashboard/media-production";

/**
 * "Sua produção" — o que o usuário realmente produziu dentro do Inst Acessor.
 *
 * Só aparecem itens que EXISTEM no banco. `value === null` significa "não foi
 * possível ler" e é exibido como "—" — nunca como 0, que seria uma afirmação
 * falsa sobre o usuário.
 */
export function ProductionBlock({ items }: { items: ProductionItem[] }) {
  return (
    <section className="bg-card border border-border-soft rounded-lg shadow-xs p-6 min-w-0">
      <div className="mb-5">
        <h2 className="font-display text-[17px] font-bold text-ink">Sua produção</h2>
        <p className="text-[13px] text-ink-soft mt-0.5 break-words">
          O que você já produziu aqui dentro.
        </p>
      </div>

      <ul className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {items.map((item) => (
          <li
            key={item.key}
            className="rounded-[16px] bg-surface/50 border border-border-soft p-4 min-w-0"
          >
            <div className="font-data font-bold text-[22px] leading-none text-ink">
              {item.value == null ? "—" : new Intl.NumberFormat("pt-BR").format(item.value)}
            </div>
            <div className="text-[12.5px] font-semibold text-ink-soft mt-1.5 break-words">
              {item.label}
            </div>
            <div className="text-[11.5px] text-ink-muted mt-0.5 break-words">
              {item.detail}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
