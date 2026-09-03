import type { Metadata } from "next";

import "../legal.css";
import { LegalShell } from "@/components/legal/legal-shell";
import { OFFICIAL_SITE_URL } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Exclusão de Dados | Inst Acessor",
  description:
    "Saiba como solicitar a exclusão dos seus dados e da sua conta no Inst Acessor, e como remover as permissões de acesso ao Instagram e TikTok.",
  alternates: {
    canonical: `${OFFICIAL_SITE_URL}/data-deletion`,
  },
};

const TOC = [
  { n: "1", label: "O que esta página cobre", href: "#visao-geral" },
  { n: "2", label: "Como solicitar a exclusão", href: "#como-solicitar" },
  { n: "3", label: "O que é excluído", href: "#o-que-excluido" },
  { n: "4", label: "Desconectar x apagar dados", href: "#desconectar-vs-apagar" },
  { n: "5", label: "O que acontece após o pedido", href: "#apos-pedido" },
  { n: "6", label: "Contato", href: "#contato" },
];

function Toc() {
  return (
    <nav className="legal-toc" aria-label="Sumário da página de exclusão de dados">
      <p className="legal-toc-title">Nesta página</p>
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

export default function DataDeletionPage() {
  return (
    <LegalShell
      eyebrow="Exclusão de dados"
      title="Exclusão de dados"
      subtitle="Como solicitar a remoção dos seus dados e da sua conta no Inst Acessor, e como revogar o acesso às suas redes sociais."
      updated="Última atualização: 1º de setembro de 2026"
      meta={
        <>
          <span className="legal-meta-item">Página de instruções para a Meta</span>
          <span className="legal-meta-item">Atende à LGPD</span>
          <span className="legal-meta-item">Vigência: 1º de setembro de 2026</span>
        </>
      }
    >
      <Toc />

      <section className="legal-section" id="visao-geral">
        <h2 className="legal-h2">
          <span className="legal-num">1</span> O que esta página cobre
        </h2>
        <p className="legal-p">
          Esta página explica como você pode solicitar a <strong>exclusão dos seus dados</strong>{" "}
          e da sua conta no Inst Acessor. Ela também serve como a página de instruções de
          exclusão de dados exigida pela Meta para aplicativos que usam o login do Facebook,
          sendo adequada para o campo <strong>"Data Deletion Instructions URL"</strong>.
        </p>
        <div className="legal-note">
          <strong>Importante:</strong> atualmente a solicitação de exclusão é feita por{" "}
          <strong>contato direto</strong> (e-mail). O Inst Acessor <em>não possui</em> ainda um
          formulário automático ou um endpoint de autodeleção dentro do aplicativo. Esta página
          descreve o processo real disponível hoje e será atualizada quando um fluxo automático
          for implementado.
        </div>
      </section>

      <section className="legal-section" id="como-solicitar">
        <h2 className="legal-h2">
          <span className="legal-num">2</span> Como solicitar a exclusão
        </h2>
        <p className="legal-p">
          Para solicitar a exclusão dos seus dados e da sua conta, siga os passos abaixo:
        </p>
        <ol className="legal-steps">
          <li className="legal-step">
            <span className="legal-step-badge" aria-hidden="true">1</span>
            <div className="legal-step-body">
              <p>
                <strong>Envie um e-mail de</strong> <code>lp070087@gmail.com</code>{" "}
                <strong>com o assunto</strong> <code>Exclusão de dados</code>. No corpo,
                informe o <strong>e-mail cadastrado no Inst Acessor</strong> e, se possível,
                as redes sociais conectadas (Instagram/TikTok).
              </p>
            </div>
          </li>
          <li className="legal-step">
            <span className="legal-step-badge" aria-hidden="true">2</span>
            <div className="legal-step-body">
              <p>
                <strong>Confirme a titularidade:</strong> para proteger seus dados, podemos
                pedir uma confirmação simples de que a conta é sua (ex.: responder a partir do
                e-mail cadastrado).
              </p>
            </div>
          </li>
          <li className="legal-step">
            <span className="legal-step-badge" aria-hidden="true">3</span>
            <div className="legal-step-body">
              <p>
                <strong>Confirmação de conclusão:</strong> após a exclusão, você receberá uma
                resposta confirmando que os dados foram removidos (ou informando o prazo
                aplicável).
              </p>
            </div>
          </li>
        </ol>
        <div className="legal-note legal-note-warn">
          <strong>Dica:</strong> o e-mail atual de contato cadastrado no projeto é{" "}
          <code>lp070087@gmail.com</code>. Se houver um canal oficial de privacidade, substitua
          o endereço aqui e nas demais páginas legais.
        </div>
      </section>

      <section className="legal-section" id="o-que-excluido">
        <h2 className="legal-h2">
          <span className="legal-num">3</span> O que é excluído
        </h2>
        <p className="legal-p">
          Ao solicitar a exclusão, os seguintes dados vinculados à sua conta são removidos ou
          anonimizados:
        </p>
        <ul className="legal-ul">
          <li>dados de cadastro (nome, e-mail, senha);</li>
          <li>dados das integrações sociais (perfil, métricas, publicações sincronizadas);</li>
          <li>tokens de acesso do Instagram e TikTok;</li>
          <li>conteúdo criado por você na plataforma (ideias, textos, agendamentos, cópias);</li>
          <li>registros de assinatura e pagamento vinculados à conta (sujeitos à retenção legal);</li>
          <li>logs e dados técnicos pessoais.</li>
        </ul>
        <p className="legal-p">
          Alguns registros podem ser mantidos de forma <strong>anonimizada</strong> para fins
          estatísticos, ou retidos quando exigido por lei (ex.: obrigações fiscais de
          pagamentos).
        </p>
      </section>

      <section className="legal-section" id="desconectar-vs-apagar">
        <h2 className="legal-h2">
          <span className="legal-num">4</span> Desconectar x apagar dados
        </h2>
        <p className="legal-p">
          <strong>Desconectar</strong> uma rede social e <strong>apagar seus dados</strong> são
          coisas diferentes:
        </p>
        <div className="legal-grid-2">
          <div className="legal-mini-card">
            <h4>Desconectar Instagram/TikTok</h4>
            <p>
              Interrompe a sincronização e o acesso às suas redes. Os dados já coletados{" "}
              <strong>permanecem</strong> na sua conta do Inst Acessor, e você pode reconectar
              depois. Faça isso em <strong>Configurações → Redes sociais</strong> ou nas
              configurações de apps conectados de cada rede.
            </p>
          </div>
          <div className="legal-mini-card">
            <h4>Apagar conta e dados</h4>
            <p>
              Remove ou anonimiza seus dados e encerra sua conta no Inst Acessor. Isso inclui os
              dados das integrações. Após a exclusão, não é possível restaurar a conta.
            </p>
          </div>
        </div>
        <p className="legal-p">
          Se você deseja apenas parar de usar o Instagram/TikTok pelo Inst Acessor,{" "}
          <strong>desconectar</strong> já resolve. Se deseja que seus dados sejam removidos da
          plataforma, solicite a <strong>exclusão</strong> conforme a seção{" "}
          <a href="#como-solicitar">Como solicitar a exclusão</a>.
        </p>
      </section>

      <section className="legal-section" id="apos-pedido">
        <h2 className="legal-h2">
          <span className="legal-num">5</span> O que acontece após o pedido
        </h2>
        <ul className="legal-ul">
          <li>
            Atenderemos ao pedido dentro dos prazos previstos na legislação aplicável
            (ex.: LGPD). Em geral, isso ocorre em até <strong>30 dias</strong>.
          </li>
          <li>
            As integrações sociais são revogadas e os tokens de acesso são invalidados para que
            o Inst Acessor não acesse mais suas contas.
          </li>
          <li>
            Você receberá uma confirmação quando a exclusão for concluída.
          </li>
          <li>
            Se houver algum impedimento legal para a exclusão total, você será informado sobre
            o que será mantido e por quê.
          </li>
        </ul>
        <div className="legal-note">
          <strong>Para remover dados também das redes sociais:</strong> a exclusão no Inst
          Acessor não apaga publicações ou dados diretamente das suas contas do Instagram ou
          TikTok. Para isso, use as ferramentas de exclusão disponíveis em cada plataforma.
        </div>
      </section>

      <section className="legal-section" id="contato">
        <h2 className="legal-h2">
          <span className="legal-num">6</span> Contato
        </h2>
        <p className="legal-p">
          Envie sua solicitação de exclusão para o e-mail:
        </p>
        <p className="legal-p">
          <a className="legal-code" href="mailto:lp070087@gmail.com?subject=Exclus%C3%A3o%20de%20dados">
            lp070087@gmail.com
          </a>
        </p>
        <p className="legal-p">
          Com o assunto <strong>"Exclusão de dados"</strong> e o e-mail cadastrado na sua conta.
        </p>

        <div className="legal-cta">
          <h3>Pronto para excluir seus dados?</h3>
          <p>
            Envie um e-mail para <code>lp070087@gmail.com</code> com o assunto{" "}
            <strong>"Exclusão de dados"</strong>. Confirmaremos o pedido e removeremos suas
            informações conforme esta política.
          </p>
          <div className="legal-cta-row">
            <a
              className="legal-btn legal-btn-grad"
              href="mailto:lp070087@gmail.com?subject=Exclus%C3%A3o%20de%20dados"
            >
              Solicitar exclusão
            </a>
            <a className="legal-btn legal-btn-ghost" href="/privacidade">
              Ver Política de Privacidade
            </a>
          </div>
        </div>
      </section>
    </LegalShell>
  );
}
