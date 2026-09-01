import type { Metadata } from "next";

import "../legal.css";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Política de Privacidade | Inst Acessor",
  description:
    "Saiba quais dados o Inst Acessor coleta, por que coleta, como usa, armazena e protege suas informações ao conectar seu Instagram ou TikTok.",
  alternates: {
    canonical: "https://inst-acessor.vercel.app/privacidade",
  },
};

const TOC = [
  { n: "1", label: "Visão geral", href: "#visao-geral" },
  { n: "2", label: "Dados que coletamos", href: "#dados-coletamos" },
  { n: "3", label: "Por que coletamos e como usamos", href: "#como-usamos" },
  { n: "4", label: "Integrações com Instagram e TikTok", href: "#integracoes" },
  { n: "5", label: "Inteligência artificial", href: "#inteligencia-artificial" },
  { n: "6", label: "Compartilhamento com terceiros", href: "#terceiros" },
  { n: "7", label: "Armazenamento e retenção", href: "#retencao" },
  { n: "8", label: "Segurança", href: "#seguranca" },
  { n: "9", label: "Cookies e sessão", href: "#cookies" },
  { n: "10", label: "Seus direitos", href: "#seus-direitos" },
  { n: "11", label: "Revogação de permissões", href: "#revogacao" },
  { n: "12", label: "Exclusão de dados", href: "#exclusao" },
  { n: "13", label: "Alterações nesta política", href: "#alteracoes" },
  { n: "14", label: "Contato", href: "#contato" },
];

function Toc() {
  return (
    <nav className="legal-toc" aria-label="Sumário da Política de Privacidade">
      <p className="legal-toc-title">Nesta política</p>
      <div className="legal-toc-grid">
        {TOC.map((i) => (
          <a key={i.n} href={i.href}>
            <span className="legal-toc-num">{i.n}</span>
            {i.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export default function PrivacidadePage() {
  return (
    <LegalShell
      eyebrow="Política de Privacidade"
      title="Política de Privacidade"
      subtitle="Como o Inst Acessor trata as informações que você compartilha ao usar a plataforma — de forma clara e sem letras miúdas."
      updated="Última atualização: 1º de setembro de 2026"
      meta={
        <>
          <span className="legal-meta-item">Vigência: 1º de setembro de 2026</span>
          <span className="legal-meta-item">Aplicável a todos os planos</span>
          <span className="legal-meta-item">Última revisão: 2026</span>
        </>
      }
    >
      <Toc />

      <section className="legal-section" id="visao-geral">
        <h2 className="legal-h2">
          <span className="legal-num">1</span> Visão geral
        </h2>
        <p className="legal-p">
          O Inst Acessor é uma plataforma de análise e crescimento de perfis sociais. Para
          funcionar, ela precisa acessar alguns dados da sua conta do Instagram ou TikTok.
          Esta Política explica, em linguagem simples, <strong>o que</strong> é coletado,{" "}
          <strong>por quê</strong>, <strong>como é usado</strong>,{" "}
          <strong>onde fica armazenado</strong> e <strong>quais são os seus direitos</strong>.
        </p>
        <p className="legal-p">
          Ao criar uma conta e conectar suas redes sociais, você concorda com o tratamento
          descrito aqui e com os nossos <a href="/termos">Termos de Uso</a>. Se você não
          concordar, pode usar a plataforma apenas para explorar o site público e não conectar
          nenhuma rede social.
        </p>
      </section>

      <section className="legal-section" id="dados-coletamos">
        <h2 className="legal-h2">
          <span className="legal-num">2</span> Dados que coletamos
        </h2>
        <p className="legal-p">Coletamos apenas as informações necessárias para operar o serviço:</p>
        <ul className="legal-ul">
          <li>
            <strong>Dados de cadastro:</strong> nome, e-mail e senha (criptografada) usados
            para criar e acessar sua conta.
          </li>
          <li>
            <strong>Dados de autenticação e sessão:</strong> cookies de sessão e tokens de
            autenticação que mantêm você conectado com segurança.
          </li>
          <li>
            <strong>Dados das integrações sociais:</strong> ao conectar o Instagram ou o TikTok,
            acessamos (com a sua autorização) informações do seu perfil, métricas de seguidores,
            alcance, engajamento, publicações e dados necessários para agendar ou publicar
            conteúdo quando você utilizar esses recursos.
          </li>
          <li>
            <strong>Tokens de acesso:</strong> credenciais de acesso às APIs do Instagram e do
            TikTok, armazenadas de forma criptografada, usadas exclusivamente para sincronizar
            suas informações.
          </li>
          <li>
            <strong>Conteúdo criado por você:</strong> textos, ideias, agendamentos e cópias
            geradas dentro da plataforma.
          </li>
          <li>
            <strong>Dados de pagamento:</strong> informações da assinatura e do checkout. O
            processamento do cartão é feito pelo provedor de pagamento (InfinitePay/Asaas); o
            Inst Acessor não armazena dados completos de cartão.
          </li>
          <li>
            <strong>Dados técnicos:</strong> logs de uso, endereço IP, tipo de navegador e
            dispositivo, páginas acessadas e horários, para segurança e melhorias.
          </li>
        </ul>
        <div className="legal-note">
          <strong>Importante:</strong> o Inst Acessor não coleta dados de menores de idade de
          forma intencional. Se você tem menos de 13 anos, não crie uma conta. O serviço é
          destinado a maiores de 18 anos.
        </div>
      </section>

      <section className="legal-section" id="como-usamos">
        <h2 className="legal-h2">
          <span className="legal-num">3</span> Por que coletamos e como usamos
        </h2>
        <p className="legal-p">Usamos os dados coletados para:</p>
        <ul className="legal-ul">
          <li>criar e gerenciar sua conta e autenticação;</li>
          <li>conectar suas contas do Instagram e TikTok e sincronizar suas métricas;</li>
          <li>gerar análises, scores e recomendações de crescimento;</li>
          <li>permitir agendamento e publicação de conteúdo nas redes que você autorizar;</li>
          <li>processar assinaturas e pagamentos;</li>
          <li>enviar comunicações essenciais sobre o serviço (ex.: confirmação de conta,
            alterações de planos);</li>
          <li>garantir segurança, prevenir fraude e abuso;</li>
          <li>melhorar a experiência, corrigir erros e analisar desempenho.</li>
        </ul>
        <p className="legal-p">
          Não vendemos seus dados pessoais e não os usamos para publicidade de terceiros.
        </p>
      </section>

      <section className="legal-section" id="integracoes">
        <h2 className="legal-h2">
          <span className="legal-num">4</span> Integrações com Instagram e TikTok
        </h2>
        <p className="legal-p">
          Quando você conecta o Instagram ou o TikTok, as permissões são concedidas por você
          diretamente na plataforma de cada rede (OAuth). O Inst Acessor acessa apenas os dados
          cobertos pelas permissões que você aprovar. Você pode revogar esse acesso a qualquer
          momento em <strong>Configurações → Redes sociais</strong> ou diretamente nas
          configurações de apps conectados do Instagram/TikTok.
        </p>
        <p className="legal-p">
          Se você usar a publicação agendada, o Inst Acessor precisará da permissão de
          publicação e postará o conteúdo nos horários que você definir. Você controla o que é
          publicado e pode cancelar agendamentos antes do envio.
        </p>
        <div className="legal-note">
          <strong>Nota sobre comentários e mensagens:</strong> recursos de comentário/mensagem
          (ex.: "Comentário → DM") só são ativados se você autorizar as permissões
          correspondentes. Sem autorização, esses dados não são coletados.
        </div>
      </section>

      <section className="legal-section" id="inteligencia-artificial">
        <h2 className="legal-h2">
          <span className="legal-num">5</span> Inteligência artificial
        </h2>
        <p className="legal-p">
          O Inst Acessor usa recursos de inteligência artificial para gerar ideias, textos,
          análises e recomendações. Esses recursos recebem o contexto que você fornece
          (nicho, objetivos, histórico de interação dentro da plataforma) e o conteúdo que você
          está criando.
        </p>
        <ul className="legal-ul">
          <li>
            <strong>Modelos de terceiros:</strong> as chamadas de IA podem ser processadas por
            provedores externos (ex.: OpenAI) quando configurados. Enviamos apenas o texto
            necessário para a geração, nunca sua senha e nunca seus tokens de acesso social.
          </li>
          <li>
            <strong>Sem treinamento com seus dados:</strong> não vendemos nem usamos seu
            conteúdo para treinar modelos de terceiros além do necessário para executar a
            solicitação.
          </li>
          <li>
            <strong>Recomendações não são aconselhamento:</strong> sugestões de IA são
            informativas e não garantem resultados.
          </li>
        </ul>
      </section>

      <section className="legal-section" id="terceiros">
        <h2 className="legal-h2">
          <span className="legal-num">6</span> Compartilhamento com terceiros
        </h2>
        <p className="legal-p">Compartilhamos dados apenas com provedores essenciais para o serviço:</p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th>Finalidade</th>
                <th>O que é compartilhado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Hospedagem e banco de dados</strong> (Vercel/Neon)</td>
                <td>Dados da conta, conteúdo e métricas sincronizadas, armazenados de forma segura.</td>
              </tr>
              <tr>
                <td><strong>Instagram/Meta e TikTok</strong></td>
                <td>Somente os dados cobertos pelas permissões que você aprovou (perfil, métricas, publicação).</td>
              </tr>
              <tr>
                <td><strong>Processamento de pagamento</strong> (InfinitePay/Asaas)</td>
                <td>Dados necessários para checkout e cobrança. Números de cartão são tratados pelo provedor.</td>
              </tr>
              <tr>
                <td><strong>Provedores de IA</strong> (quando ativados)</td>
                <td>Texto das solicitações de geração, sem senhas e sem tokens sociais.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="legal-p">
          Exigimos desses provedores o cumprimento de obrigações de proteção de dados. Não
          compartilhamos seus dados com outros usuários, parceiros comerciais ou para
          publicidade.
        </p>
      </section>

      <section className="legal-section" id="retencao">
        <h2 className="legal-h2">
          <span className="legal-num">7</span> Armazenamento e retenção
        </h2>
        <p className="legal-p">
          Seus dados ficam armazenados em banco de dados gerenciado com criptografia em trânsito
          (TLS) e em repouso, em servidores de provedores de infraestrutura confiáveis. Mantemos
          seus dados enquanto sua conta estiver ativa e pelo tempo necessário para cumprir
          obrigações legais, resolver disputas e garantir segurança.
        </p>
        <ul className="legal-ul">
          <li>
            <strong>Tokens de acesso social:</strong> armazenados criptografados e renovados
            periodicamente; são removidos quando você desconecta a integração ou encerra a conta.
          </li>
          <li>
            <strong>Dados de métricas:</strong> mantidos para que você acompanhe sua evolução
            ao longo do tempo.
          </li>
          <li>
            <strong>Logs técnicos:</strong> mantidos por período limitado para fins de segurança
            e depuração.
          </li>
        </ul>
      </section>

      <section className="legal-section" id="seguranca">
        <h2 className="legal-h2">
          <span className="legal-num">8</span> Segurança
        </h2>
        <p className="legal-p">Adotamos medidas técnicas e organizacionais adequadas, incluindo:</p>
        <ul className="legal-ul">
          <li>criptografia de senhas (hash) e de tokens de acesso (AES-256-GCM);</li>
          <li>transmissão de dados via HTTPS/TLS;</li>
          <li>controle de acesso baseado no princípio do menor privilégio;</li>
          <li>proteção das rotas administrativas e separação por usuário;</li>
          <li>logs e monitoramento para detecção de acesso anômalo.</li>
        </ul>
        <p className="legal-p">
          Nenhum sistema é 100% seguro. Em caso de incidente que afete seus dados, notificaremos
          você e as autoridades competentes quando exigido pela legislação.
        </p>
      </section>

      <section className="legal-section" id="cookies">
        <h2 className="legal-h2">
          <span className="legal-num">9</span> Cookies e sessão
        </h2>
        <p className="legal-p">
          Usamos cookies e armazenamento local estritamente necessários para autenticação e
          funcionamento da plataforma (ex.: manter você conectado, lembrar preferências de
          interface). Não usamos cookies de publicidade de terceiros.
        </p>
        <p className="legal-p">
          Você pode limpar os cookies pelo seu navegador a qualquer momento; isso pode exigir
          novo login.
        </p>
      </section>

      <section className="legal-section" id="seus-direitos">
        <h2 className="legal-h2">
          <span className="legal-num">10</span> Seus direitos
        </h2>
        <p className="legal-p">
          Em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018) e
          demais legislações aplicáveis, você pode:
        </p>
        <ul className="legal-ul">
          <li>solicitar acesso aos seus dados pessoais;</li>
          <li>solicitar correção de dados incompletos ou desatualizados;</li>
          <li>solicitar anonimização, bloqueio ou eliminação de dados desnecessários;</li>
          <li>solicitar portabilidade dos dados (quando tecnicamente aplicável);</li>
          <li>revogar consentimentos a qualquer momento;</li>
          <li>solicitar a exclusão dos seus dados.</li>
        </ul>
        <p className="legal-p">
          Para exercer esses direitos, veja a seção <a href="#contato">Contato</a> ou a página{" "}
          <a href="/data-deletion">Exclusão de dados</a>.
        </p>
      </section>

      <section className="legal-section" id="revogacao">
        <h2 className="legal-h2">
          <span className="legal-num">11</span> Revogação de permissões
        </h2>
        <p className="legal-p">
          Você pode revogar o acesso do Inst Acessor às suas redes sociais a qualquer momento:
        </p>
        <ul className="legal-ul">
          <li>
            <strong>Na plataforma:</strong> em <strong>Configurações → Redes sociais</strong>,
            escolha desconectar a conta desejada.
          </li>
          <li>
            <strong>No Instagram/Meta:</strong> em "Apps e sites" nas configurações da sua conta.
          </li>
          <li>
            <strong>No TikTok:</strong> em "Segurança e permissões" nas configurações da sua conta.
          </li>
        </ul>
        <p className="legal-p">
          Ao desconectar, o Inst Acessor deixa de sincronizar dados daquela rede. Os dados já
          coletados permanecem armazenados conforme a política de retenção, salvo se você
          solicitar a exclusão.
        </p>
      </section>

      <section className="legal-section" id="exclusao">
        <h2 className="legal-h2">
          <span className="legal-num">12</span> Exclusão de dados
        </h2>
        <p className="legal-p">
          Você pode solicitar a exclusão dos seus dados e da sua conta. Para isso, veja as
          instruções na página <a href="/data-deletion">Exclusão de dados</a>. Atenderemos às
          solicitações dentro dos prazos legais, salvo quando a retenção for obrigatória por lei.
        </p>
      </section>

      <section className="legal-section" id="alteracoes">
        <h2 className="legal-h2">
          <span className="legal-num">13</span> Alterações nesta política
        </h2>
        <p className="legal-p">
          Podemos atualizar esta Política periodicamente. Mudanças relevantes serão comunicadas
          por meio da plataforma ou do e-mail cadastrado. A versão vigente estará sempre
          disponível em <a href="/privacidade">/privacidade</a>.
        </p>
      </section>

      <section className="legal-section" id="contato">
        <h2 className="legal-h2">
          <span className="legal-num">14</span> Contato
        </h2>
        <p className="legal-p">
          Para dúvidas sobre esta Política, sobre seus dados ou para exercer seus direitos,
          fale conosco pelo e-mail:
        </p>
        <p className="legal-p">
          <a className="legal-code" href="mailto:lp070087@gmail.com">lp070087@gmail.com</a>
        </p>
        <div className="legal-note">
          <strong>Atenção:</strong> este é o canal de contato atualmente cadastrado no projeto.
          Se houver um e-mail oficial dedicado a privacidade, substitua nesta página e na
          página de exclusão de dados.
        </div>
      </section>
    </LegalShell>
  );
}
