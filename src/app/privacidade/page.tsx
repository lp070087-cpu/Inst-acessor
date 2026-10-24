import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Privacidade — Inst Acessor", description: "Dados tratados e limites da versão de homologação.", robots: { index: false, follow: false } };

export default function PrivacyPage() {
  return <LegalPage title="Privacidade" description="Informações sobre dados utilizados pelo Inst Acessor. O responsável pelo tratamento, o contato e as condições finais ainda dependem de definição e revisão jurídica.">
    <LegalSection id="dados" title="Quais dados podem ser utilizados">
      <p>Dados de conta e autenticação, como nome, email, senha protegida por hash, estado da conta e sessão; dados de plano, assinatura e acesso; e registros técnicos necessários para segurança e diagnóstico.</p>
      <p>Quando uma integração é autorizada: identificadores da conta social, permissões e tokens de conexão, informações do perfil, métricas disponíveis, publicações e interações pertinentes aos recursos habilitados. Caixa de entrada e comentários podem incluir dados de outras pessoas que interagem com a conta conectada.</p>
      <p>Conteúdos enviados ou criados, incluindo originais, arquivos editados, rascunhos, legendas, projetos de edição e contexto fornecido à IA. Evite inserir informações pessoais que não sejam necessárias à função utilizada.</p>
    </LegalSection>
    <LegalSection id="finalidades" title="Para que os dados são usados">
      <p>Autenticar e autorizar acessos, manter conteúdo e projetos, apresentar análises, atender solicitações de geração de texto e executar publicações, respostas e agendamentos escolhidos. Eventos de cobrança atualizam assinatura e acesso; registros técnicos ajudam a evitar duplicidade, abuso e falhas.</p>
      <p>As recomendações de IA dependem do contexto disponível e podem estar incorretas. Revise os resultados antes de utilizá-los ou publicá-los. Ausência de dados suficientes não deve ser apresentada como uma conclusão comprovada.</p>
    </LegalSection>
    <LegalSection id="fornecedores" title="Serviços envolvidos e compartilhamento necessário">
      <p>A implantação prevista utiliza Vercel para hospedagem, Neon/PostgreSQL para dados e Vercel Blob para arquivos. Mídias destinadas à publicação podem ficar acessíveis por URL pública, inclusive originais enviados à Biblioteca; não trate esses endereços como armazenamento privado.</p>
      <p>Asaas processa os dados de pagamento necessários ao checkout e aos eventos financeiros. Meta/Instagram e TikTok recebem ou fornecem dados nas ações autorizadas. Provedores de IA, como OpenAI ou Gemini, recebem o contexto enviado para a geração quando configurados; o provedor de email recebe os dados necessários às mensagens habilitadas.</p>
      <p>Nem todos os serviços estão necessariamente ativos na homologação. Contratos, locais de processamento, eventuais transferências internacionais e regras de retenção dos fornecedores precisam ser confirmados na configuração final. Não há afirmação de que esses dados sejam processados exclusivamente no Brasil.</p>
    </LegalSection>
    <LegalSection id="seguranca" title="Segurança, sessão e retenção">
      <p>O código contém controles de acesso por usuário, proteção de senhas, sessões e tokens, validação de uploads e registros operacionais. Essas medidas não eliminam todos os riscos. A proteção efetiva também depende da configuração do ambiente e dos fornecedores.</p>
      <p>A sessão utiliza mecanismos de autenticação no navegador. Esta página não declara uma auditoria completa de cookies e rastreadores da configuração publicada.</p>
      <p>Os prazos de retenção por categoria e de expiração dos backups ainda precisam ser definidos e implementados. Dados necessários a obrigações aplicáveis, segurança, integridade financeira ou tratamento de solicitações podem exigir conservação limitada e justificada. Não é prometida exclusão imediata de todas as cópias.</p>
    </LegalSection>
    <LegalSection id="direitos" title="Solicitações e direitos relacionados aos dados">
      <p>O procedimento final deverá permitir solicitar informações sobre tratamento e compartilhamento, acesso e correção de dados, revisão das autorizações e exclusão quando cabível, com confirmação segura da identidade. A análise depende da natureza do pedido e das condições aplicáveis.</p>
      <p>O canal oficial ainda não está definido nesta versão; esta página não recebe solicitações. Consulte “Exclusão de dados” para os limites atuais. A identificação do responsável, o canal operacional e a revisão jurídica são condições pendentes antes da abertura ao público.</p>
      <p>Informações oficiais sobre o tema estão disponíveis na <a className="rounded text-purple underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple" href="https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares">orientação da ANPD sobre direitos dos titulares</a>.</p>
    </LegalSection>
  </LegalPage>;
}
