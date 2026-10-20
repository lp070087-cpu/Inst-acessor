import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Termos de uso — Inst Acessor", description: "Termos de homologação e limites do Inst Acessor.", robots: { index: false, follow: false } };

export default function TermsPage() {
  return <LegalPage title="Termos de uso" description="Condições de uso da versão de homologação do Inst Acessor. A oferta comercial e esta documentação precisam de validação final antes da publicação.">
    <LegalSection id="servico" title="O serviço e sua disponibilidade">
      <p>O Inst Acessor reúne planejamento, edição de conteúdo, análises, recursos de inteligência artificial e ferramentas para contas sociais. A disponibilidade depende do plano, da configuração, das permissões da conta e das capacidades das APIs. Uma tela disponível não significa que uma integração já esteja aprovada para uso real.</p>
      <p>Não há garantia de crescimento, alcance, seguidores ou resultado financeiro. Métricas dependem dos dados disponíveis; exemplos e dados fictícios de teste não representam resultados obtidos por clientes.</p>
    </LegalSection>
    <LegalSection id="conta" title="Conta, acesso e conteúdo">
      <p>Utilize contas e materiais que você possa administrar e compartilhar. Proteja suas credenciais e respeite os direitos de terceiros. Cadastro gratuito não concede automaticamente acesso aos recursos pagos.</p>
      <p>A titularidade dos materiais continua com seus respectivos titulares. O funcionamento dos recursos exige armazenar e processar os dados e mídias necessários às ações escolhidas. Condições jurídicas específicas dessa utilização ainda serão revisadas.</p>
    </LegalSection>
    <LegalSection id="integracoes" title="Publicação, mensagens e integrações">
      <p>Instagram/Meta e TikTok dependem de autorização, tipo de conta, permissões, análise do aplicativo e regras das plataformas. O Inst Acessor é independente e não representa essas empresas. Não são utilizados endpoints privados como alternativa a permissões ausentes.</p>
      <p>Revise mídia, legenda, destinatários e horário antes de confirmar uma ação. Conteúdos gerados por IA permitem revisão humana. Respostas automáticas dependem das regras autorizadas pelo usuário; habilitar uma regra pode permitir envio sem aprovação individual.</p>
      <p>Agendamentos dependem de infraestrutura ativa e conexão válida. Em falhas com resultado incerto, a publicação pode exigir reconciliação antes de qualquer nova tentativa. Não é prometido reenvio automático nem execução sem interrupções.</p>
    </LegalSection>
    <LegalSection id="pagamento" title="Planos, pagamento e cancelamento">
      <p>Asaas é o gateway oficial. Os meios previstos são PIX e cartão, conforme a oferta apresentada no checkout. Preços, periodicidade, renovação e condições precisam ser conferidos na oferta aprovada; valores históricos não são reproduzidos aqui como preços vigentes.</p>
      <p>Desconectar uma rede social, sair da conta ou solicitar exclusão de dados não equivale a cancelar uma assinatura. Cancelamento, reembolso e contestação dependem do fluxo disponível, da confirmação do processamento e das condições aplicáveis, que devem ser validadas antes da comercialização.</p>
      <p>Na homologação, operações financeiras externas exigem autorização e ambiente de teste. A aprovação de um teste com dados simulados não comprova cobrança ou estorno reais.</p>
    </LegalSection>
    <LegalSection id="limites" title="Limites técnicos e atualização">
      <p>O editor preserva originais e pode gerar arquivos derivados. A exportação de vídeo depende dos recursos do dispositivo e do navegador; formatos destinados apenas a download não são anunciados como publicáveis. Mídias hospedadas para publicação podem usar URLs públicas.</p>
      <p>Fornecedores, APIs e limites técnicos podem mudar. Alterações relevantes na oferta e nestes termos precisam ser comunicadas por um canal oficial. A identificação do responsável, o canal de atendimento e a versão jurídica final permanecem pendências de lançamento.</p>
    </LegalSection>
  </LegalPage>;
}
