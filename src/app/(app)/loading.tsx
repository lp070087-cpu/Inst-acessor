import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/**
 * LOADING DO GRUPO (app) — FEEDBACK IMEDIATO NA TROCA DE ABA.
 *
 * Antes deste arquivo não existia NENHUM `loading.tsx` no projeto. Sem o
 * arquivo, o App Router mantém a página anterior congelada na tela até o
 * servidor terminar de renderizar a próxima — o usuário clica na aba, nada
 * muda, e a troca parece "travada". O gargalo real (consultas repetidas e
 * sequenciais) foi corrigido em `access/premium.ts` e em `(app)/layout.tsx`;
 * este esqueleto é a segunda metade da correção: o clique RESPONDE na hora,
 * mesmo em conexão lenta.
 *
 * É genérico de propósito — cobre todas as rotas do grupo (dashboard,
 * biblioteca, preview, calendário, rank…) sem inventar a forma de nenhuma tela
 * específica. Reaproveita o `Skeleton` já existente na identidade visual.
 *
 * `animate-pulse` respeita `prefers-reduced-motion`: a regra global em
 * `globals.css` reduz a duração das animações para ~0, então o esqueleto
 * apenas aparece estável, sem piscar, para quem pediu menos movimento.
 */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Carregando">
      {/* Cabeçalho da página: ícone + título + descrição */}
      <div className="flex items-start gap-3">
        <Skeleton variant="circle" className="w-11 h-11 flex-none" />
        <div className="flex flex-col gap-2 pt-1">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-3.5 w-72 max-w-[70vw]" />
        </div>
      </div>

      {/* Faixa de métricas/cards do topo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonCard lines={1} />
        <SkeletonCard lines={1} />
        <SkeletonCard lines={1} />
        <SkeletonCard lines={1} />
      </div>

      {/* Bloco principal (gráfico/lista) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
