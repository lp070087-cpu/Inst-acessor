import type { Metadata } from "next";

import "../legal.css";
import { LegalShell } from "@/components/legal/legal-shell";
import { OFFICIAL_SITE_URL } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Termos de Uso | Inst Acessor",
  description:
    "Termos de uso da plataforma Inst Acessor: uso do serviço, contas, integrações com Instagram e TikTok, pagamentos, responsabilidades e mais.",
  alternates: {
    canonical: `${OFFICIAL_SITE_URL}/termos`,
  },
};

const TOC = [
  { n: "1", label: "Aceitação dos termos", href: "#aceitacao" },
  { n: "2", label: "Descrição do serviço", href: "#servico" },
  { n: "3", label: "Contas e credenciais", href: "#contas" },
  { n: "4", label: "Conexão com Instagram e TikTok", href: "#conexao" },
  { n: "5", label: "Permissões", href: "#permissoes" },
  { n: "6", label: "Conteúdo do usuário", href: "#conteudo" },
  { n: "7", label: "Inteligência artificial e recomendações", href: "#ia" },
  { n: "8", label: "Publicação e agendamento", href: "#publicacao" },
  { n: "9", label: "Responsabilidades do usuário", href: "#responsabilidades" },
  { n: "10", label: "Disponibilidade do serviço", href: "#disponibilidade" },
  { n: "11", label: "Planos e pagamentos", href: "#planos" },
  { n: "12", label: "Cancelamento e acesso", href: "#cancelamento" },
  { n: "13", label: "Uso aceitável e proibições", href: "#proibicoes" },
  { n: "14", label: "Propriedade intelectual", href: "#propriedade" },
  { n: "15", label: "Limitação de responsabilidade", href: "#limitacao" },
  { n: "16", label: "Alterações dos termos", href: "#alteracoes" },
  { n: "17", label: "Contato", href: "#contato" },
];

function Toc() {
  return (
    <nav className="legal-toc" aria-label="Sumário dos Termos de Uso">
      <p className="legal-toc-title">Nestes termos</p>
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

export default function TermosPage() {
  return (
    <LegalShell
      eyebrow="Termos de Uso"
      title="Termos de Uso"
      subtitle="As regras que regem o uso da plataforma Inst Acessor, seus recursos e suas integrações com redes sociais."
      updated="Última atualização: 1º de setembro de 2026"
      meta={
        <>
          <span className="legal-meta-item">Vigência: 1º de setembro de 2026</span>
          <span className="legal-meta-item">Aplicável a todos os planos</span>
          <span className="legal-meta-item">Leia junto com a Política de Privacidade</span>
        </>
      }
    >
      <Toc />

      <section className="legal-section" id="aceitacao">
        <h2 className="legal-h2">
          <span className="legal-num">1</span> Aceitação dos termos
        </h2>
        <p className="legal-p">
          Ao criar uma conta ou utilizar o Inst Acessor, você concorda com estes Termos de Uso
          e com a nossa <a href="/privacidade">Política de Privacidade</a>. Se você não
          concordar, não utilize o serviço.
        </p>
        <p className="legal-p">
          O serviço é destinado a <strong>maiores de 18 anos</strong>.
        </p>
      </section>

      <section className="legal-section" id="servico">
        <h2 className="legal-h2">
          <span className="legal-num">2</span> Descrição do serviço
        </h2>
        <p className="legal-p">
          O Inst Acessor é uma plataforma SaaS de análise, planejamento e crescimento de perfis
          de Instagram e TikTok. Entre os recursos estão: dashboard de métricas, score de
          crescimento, diagnóstico, geração de ideias e cópias com IA, calendário e pipeline de
          conteúdo, publicação agendada, automações e relatórios.
        </p>
        <p className="legal-p">
          As funcionalidades disponíveis podem variar conforme o plano contratado.
        </p>
      </section>

      <section className="legal-section" id="contas">
        <h2 className="legal-h2">
          <span className="legal-num">3</span> Contas e credenciais
        </h2>
        <ul className="legal-ul">
          <li>
            Você é responsável por manter a confidencialidade da sua senha e pelas atividades
            realizadas na sua conta.
          </li>
          <li>
            Você deve fornecer dados de cadastro verdadeiros e manter suas informações
            atualizadas.
          </li>
          <li>
            Você não pode criar contas em nome de terceiros sem autorização, nem compartilhar
            suas credenciais.
          </li>
          <li>
            O Inst Acessor pode suspender ou encerrar contas que violem estes Termos ou que
            representem risco à plataforma.
          </li>
        </ul>
      </section>

      <section className="legal-section" id="conexao">
        <h2 className="legal-h2">
          <span className="legal-num">4</span> Conexão com Instagram e TikTok
        </h2>
        <p className="legal-p">
          Ao conectar sua conta do Instagram ou TikTok, você autoriza o Inst Acessor a acessar,
          por meio das APIs oficiais e do protocolo OAuth, as informações cobertas pelas
          permissões que você aprovar.
        </p>
        <p className="legal-p">
          Você é o único responsável por garantir que tem o direito de conectar a conta e de
          usar os dados dela, inclusive no caso de contas empresariais que gerencie em nome de
          terceiros.
        </p>
        <p className="legal-p">
          O Inst Acessor não é afiliado ao Instagram, à Meta Platforms ou ao TikTok. As marcas
          pertencem aos seus respectivos proprietários.
        </p>
      </section>

      <section className="legal-section" id="permissoes">
        <h2 className="legal-h2">
          <span className="legal-num">5</span> Permissões
        </h2>
        <p className="legal-p">
          O Inst Acessor solicita apenas as permissões necessárias para cada recurso. Você pode
          revogar as permissões a qualquer momento nas configurações da plataforma ou
          diretamente no Instagram/TikTok. A revogação pode limitar funcionalidades, como a
          sincronização e a publicação.
        </p>
      </section>

      <section className="legal-section" id="conteudo">
        <h2 className="legal-h2">
          <span className="legal-num">6</span> Conteúdo do usuário
        </h2>
        <p className="legal-p">
          Você mantém a titularidade do conteúdo que criar na plataforma (ideias, textos,
          agendamentos, cópias). Ao utilizá-la, você concede ao Inst Acessor uma licença
          limitada, não exclusiva e revogável, para armazenar, processar e exibir esse conteúdo
          exclusivamente para operar o serviço.
        </p>
        <p className="legal-p">
          Você é responsável pelo conteúdo que produz e publica, incluindo a observância de
          direitos de terceiros e das políticas de cada rede social.
        </p>
      </section>

      <section className="legal-section" id="ia">
        <h2 className="legal-h2">
          <span className="legal-num">7</span> Inteligência artificial e recomendações
        </h2>
        <ul className="legal-ul">
          <li>
            As sugestões geradas por IA (ideias, textos, análises, scores) têm caráter
            informativo e não constituem garantia de resultados.
          </li>
          <li>
            Você é responsável por revisar e aprovar qualquer conteúdo antes de publicar,
            inclusive para verificar exatidão, tom e conformidade com as políticas das redes.
          </li>
          <li>
            O Inst Acessor não se responsabiliza por decisões tomadas com base exclusivamente
            nas recomendações da plataforma.
          </li>
        </ul>
      </section>

      <section className="legal-section" id="publicacao">
        <h2 className="legal-h2">
          <span className="legal-num">8</span> Publicação e agendamento
        </h2>
        <p className="legal-p">
          Os recursos de agendamento e publicação enviam conteúdo para suas contas conectadas
          nos horários configurados por você. Você é o único responsável:
        </p>
        <ul className="legal-ul">
          <li>pelo conteúdo publicado e sua conformidade com as regras de cada rede;</li>
          <li>por configurar corretamente os horários e revisar o que será postado;</li>
          <li>por possíveis falhas de publicação decorrentes de limites das APIs, da rede ou
            de revogação de permissões.</li>
        </ul>
        <p className="legal-p">
          O Inst Acessor fará esforços razoáveis para publicar conforme agendado, mas não
          garante a publicação em caso de indisponibilidade das APIs externas, suspensão da sua
          conta na rede ou erro de configuração.
        </p>
      </section>

      <section className="legal-section" id="responsabilidades">
        <h2 className="legal-h2">
          <span className="legal-num">9</span> Responsabilidades do usuário
        </h2>
        <p className="legal-p">Você concorda em:</p>
        <ul className="legal-ul">
          <li>utilizar a plataforma de acordo com a lei e com estes Termos;</li>
          <li>não tentar acessar dados de outros usuários;</li>
          <li>não utilizar o serviço para fins ilícitos, fraudulentos ou que violem direitos
            de terceiros;</li>
          <li>não criar conteúdo enganoso, difamatório ou que infrinja propriedade intelectual;</li>
          <li>manter suas integrações e permissões em dia.</li>
        </ul>
      </section>

      <section className="legal-section" id="disponibilidade">
        <h2 className="legal-h2">
          <span className="legal-num">10</span> Disponibilidade do serviço
        </h2>
        <p className="legal-p">
          O Inst Acessor busca manter o serviço disponível, mas não garante disponibilidade
          ininterrupta. Manutenções programadas, falhas de infraestrutura, limitações das APIs
          das redes sociais ou fatores fora do nosso controle podem causar indisponibilidade.
        </p>
      </section>

      <section className="legal-section" id="planos">
        <h2 className="legal-h2">
          <span className="legal-num">11</span> Planos e pagamentos
        </h2>
        <ul className="legal-ul">
          <li>
            Os planos, preços e períodos de vigência estão descritos na página{" "}
            <a href="/#planos">Planos</a> e podem ser alterados com aviso prévio.
          </li>
          <li>
            O pagamento é processado por provedores de pagamento terceiros (InfinitePay/Asaas).
            O Inst Acessor não armazena dados completos de cartão.
          </li>
          <li>
            A não realização do pagamento na renovação pode suspender o acesso aos recursos
            pagos até a regularização.
          </li>
          <li>
            Valores cobrados podem variar conforme o plano contratado e promoções aplicadas no
            momento da compra.
          </li>
        </ul>
        <div className="legal-note">
          <strong>Reembolsos:</strong> solicitações de reembolso seguem as políticas do
          provedor de pagamento e a legislação aplicável. Entre em contato pelo canal indicado
          na seção <a href="#contato">Contato</a>.
        </div>
      </section>

      <section className="legal-section" id="cancelamento">
        <h2 className="legal-h2">
          <span className="legal-num">12</span> Cancelamento e acesso
        </h2>
        <p className="legal-p">
          Você pode encerrar sua conta e solicitar a exclusão dos seus dados a qualquer momento.
          Veja as instruções na página <a href="/data-deletion">Exclusão de dados</a>.
        </p>
        <p className="legal-p">
          O Inst Acessor pode suspender ou encerrar seu acesso em caso de violação destes
          Termos, conduta abusiva, risco à plataforma ou exigência legal. Encerramentos por
          violação não geram direito a reembolso.
        </p>
      </section>

      <section className="legal-section" id="proibicoes">
        <h2 className="legal-h2">
          <span className="legal-num">13</span> Uso aceitável e proibições
        </h2>
        <p className="legal-p">É proibido utilizar o serviço para:</p>
        <ul className="legal-ul">
          <li>praticar ou incentivar fraudes, golpes ou atividades ilícitas;</li>
          <li>coletar dados de outros usuários sem autorização;</li>
          <li>violar as políticas do Instagram/Meta ou do TikTok;</li>
          <li>tentar burlar a segurança, os limites de uso ou os mecanismos de cobrança;</li>
          <li>reproduzir, revender ou explorar comercialmente a plataforma sem autorização;</li>
          <li>usar robôs, scraping ou automação não autorizada para acessar o serviço.</li>
        </ul>
      </section>

      <section className="legal-section" id="propriedade">
        <h2 className="legal-h2">
          <span className="legal-num">14</span> Propriedade intelectual
        </h2>
        <p className="legal-p">
          A plataforma Inst Acessor, incluindo seu código, design, textos institucionais, marca,
          logotipo e demais elementos visuais, é de propriedade do Inst Acessor ou de seus
          licenciantes. Nada nestes Termos concede a você qualquer direito sobre esses ativos,
          exceto o direito limitado de uso do serviço.
        </p>
      </section>

      <section className="legal-section" id="limitacao">
        <h2 className="legal-h2">
          <span className="legal-num">15</span> Limitação de responsabilidade
        </h2>
        <p className="legal-p">
          Na máxima extensão permitida pela lei, o Inst Acessor não será responsável por danos
          indiretos, incidentais, especiais ou consequentes, incluindo lucros cessantes,
          decorrentes do uso ou da impossibilidade de uso do serviço.
        </p>
        <p className="legal-p">
          O Inst Acessor não se responsabiliza por perdas ou restrições impostas por redes
          sociais (Instagram/Meta, TikTok), por ações de provedores de pagamento ou por atos de
          terceiros.
        </p>
        <p className="legal-p">
          Nada nesta cláusula exclui ou limita responsabilidade que não possa ser excluída ou
          limitada por lei aplicável.
        </p>
      </section>

      <section className="legal-section" id="alteracoes">
        <h2 className="legal-h2">
          <span className="legal-num">16</span> Alterações dos termos
        </h2>
        <p className="legal-p">
          Podemos atualizar estes Termos periodicamente. Mudanças relevantes serão comunicadas
          pela plataforma ou pelo e-mail cadastrado. A versão vigente estará sempre disponível
          em <a href="/termos">/termos</a>. O uso continuado do serviço após a alteração
          implica aceitação dos novos termos.
        </p>
      </section>

      <section className="legal-section" id="contato">
        <h2 className="legal-h2">
          <span className="legal-num">17</span> Contato
        </h2>
        <p className="legal-p">
          Para dúvidas sobre estes Termos, entre em contato pelo e-mail:
        </p>
        <p className="legal-p">
          <a className="legal-code" href="mailto:lp070087@gmail.com">lp070087@gmail.com</a>
        </p>
      </section>
    </LegalShell>
  );
}
