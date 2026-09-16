import { redirect } from "next/navigation";

/**
 * ROTA ANTIGA — "Gerador de Copy" foi incorporado ao Preview Social.
 *
 * A geração de copy NÃO foi removida: o motor continua o mesmo
 * (`generateCopy()` + `POST /api/ai/generate-copy`), a biblioteca de legendas
 * salvas continua em `ai.copy` (`/api/copy`) e o componente `CopyGenerator`
 * segue no projeto. O que mudou é que criar, editar, visualizar e salvar
 * agora acontecem numa única tela — então este módulo deixou de existir como
 * destino separado.
 *
 * Este redirect preserva qualquer link, favorito ou histórico que aponte para
 * `/gerador-de-copy`, em vez de devolver um 404.
 */
export default function GeradorCopyPage() {
  redirect("/preview-social");
}
