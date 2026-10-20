import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Exclusão de dados — Inst Acessor", description: "Procedimento e pendências para exclusão de dados.", robots: { index: false, follow: false } };

export default function DataDeletionPage() {
  return <LegalPage title="Exclusão de dados" description="Esta página explica o procedimento e suas pendências. Ela não recebe pedidos, não confirma uma solicitação e não executa exclusão automática.">
    <LegalSection id="estado" title="Situação da versão de homologação">
      <p>O responsável e o canal de atendimento para solicitações de exclusão ainda precisam ser definidos. Não há nesta versão um formulário público ou um fluxo completo de exclusão de conta validado. Esse atendimento deve estar operacional antes da abertura ao público e da submissão que exija esse procedimento.</p>
      <p>Não envie senhas, tokens de redes sociais ou documentos por páginas ou canais não confirmados. Nenhuma exclusão é iniciada apenas por visitar este endereço.</p>
    </LegalSection>
    <LegalSection id="desconectar" title="Desconectar uma conta social">
      <p>A área Redes Sociais contém ações de desconexão. Elas removem a conexão mantida pelo aplicativo conforme o recurso disponível; isso não equivale à exclusão completa da conta, das mídias, dos históricos ou dos dados mantidos pelo provedor.</p>
      <p>Também é possível revisar e remover as permissões do aplicativo nas configurações da própria Meta/Instagram ou do TikTok. Desconectar não remove automaticamente publicações ou mensagens já entregues nas plataformas.</p>
    </LegalSection>
    <LegalSection id="procedimento" title="Como deverá funcionar uma solicitação">
      <ol className="list-decimal space-y-2 pl-5">
        <li>Identificar o pedido e o seu alcance: dados de uma integração, conteúdos específicos ou encerramento da conta.</li>
        <li>Confirmar a identidade por um procedimento seguro, solicitando apenas as informações necessárias.</li>
        <li>Verificar assinatura, publicações em processamento, dados compartilhados e possíveis necessidades justificadas de conservação.</li>
        <li>Executar as ações autorizadas e informar o resultado, os limites e eventuais dados retidos. O mecanismo de acompanhamento ainda precisa ser implementado.</li>
      </ol>
      <p>Essas etapas descrevem o procedimento a concluir, e não um pedido já registrado. Não há prazo de resposta ou de exclusão confirmado nesta versão.</p>
    </LegalSection>
    <LegalSection id="alcance" title="Alcance, assinaturas e cópias">
      <p>Rascunhos, originais e derivados, projetos de edição, conexões, registros de IA e interações precisam ser considerados conforme o pedido. Retenção de dados financeiros, registros necessários e backups deve seguir regras específicas ainda pendentes de revisão e configuração.</p>
      <p>Excluir dados do aplicativo não garante a remoção de cópias já baixadas, caches ou dados mantidos por destinatários e plataformas. A remoção de arquivos hospedados exige análise das referências para não prejudicar conteúdos ainda utilizados.</p>
      <p>Exclusão de dados e cancelamento de assinatura são procedimentos distintos. O eventual cancelamento financeiro precisa ser solicitado e confirmado pelo fluxo operacional correspondente; não é prometido cancelamento automático por desconexão ou exclusão.</p>
      <p>Consulte também a <Link className="text-purple underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple" href="/privacidade">página de privacidade</Link>. O texto final depende de revisão jurídica e de validação do procedimento real.</p>
    </LegalSection>
  </LegalPage>;
}
