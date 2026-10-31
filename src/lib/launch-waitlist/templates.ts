import { PLAN_CATALOG, planShortName } from "@/lib/billing/plans/display";

const esc = (text: string) => text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
function link(value: string) {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && ["test", "development"].includes(process.env.NODE_ENV ?? "");
  if (url.username || url.password || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) throw new Error("INVALID_CAMPAIGN_LINK");
  return url.href;
}

/** Limits for admin-authored NEWS content (also enforced by the admin schema). */
export const NEWS_SUBJECT_MAX = 120;
export const NEWS_BODY_MAX = 2000;
/** Removes control characters; subject is single-line, body keeps line breaks. */
export function cleanNewsSubject(value: string) {
  return value.replace(/[\u0000-\u001f\u007f-\u009f  ]+/g, " ").replace(/\s+/g, " ").trim();
}
export function cleanNewsBody(value: string) {
  return value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f  ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/** Pure responsive templates. Rendering never performs delivery or opens a sale. */
export function renderLaunchMessage(input: {
  kind: "VERIFY" | "WELCOME" | "LAUNCH" | "NEWS"; name: string; planSlug: string;
  unsubscribeUrl: string; preferencesUrl?: string; confirmationUrl?: string; saleUrl?: string; presaleApproved?: boolean;
  /** NEWS only: admin-authored, plain text (escaped in HTML), length-limited. */
  newsSubject?: string; newsBody?: string; newsCtaUrl?: string;
}) {
  const plan = PLAN_CATALOG.find(item => item.slug === input.planSlug);
  if (!plan || !["semanal", "mensal", "anual"].includes(plan.slug)) throw new Error("INVALID_CAMPAIGN_PLAN");
  const name = input.name.trim().slice(0, 100), interest = planShortName(plan);
  const unsubscribe = link(input.unsubscribeUrl);
  const preferences = input.preferencesUrl ? link(input.preferencesUrl) : undefined;
  if (preferences && new URL(preferences).origin !== new URL(unsubscribe).origin) throw new Error("CAMPAIGN_ORIGIN_MISMATCH");
  let subject: string, body: string, target: string | undefined, action: string | undefined;
  if (input.kind === "VERIFY") {
    if (!input.confirmationUrl) throw new Error("CONFIRMATION_REQUIRED");
    target = link(input.confirmationUrl); action = "Confirmar minha inscrição";
    subject = "Confirme sua inscrição no Inst Acessor";
    body = `Olá, ${name}. Confirme que deseja participar da lista de espera, com interesse no plano ${interest}. Este link expira em 24 horas. Se não foi você, ignore esta mensagem; a inscrição não será ativada.`;
  } else if (input.kind === "WELCOME") {
    subject = "Bem-vindo à lista de espera do Inst Acessor";
    body = `Olá, ${name}! Sua inscrição na lista de espera do Inst Acessor foi confirmada. Registramos seu interesse no plano ${interest}. Avisaremos pelo canal autorizado quando a pré-venda começar. Ainda não há uma data de abertura anunciada.`;
  } else if (input.kind === "NEWS") {
    const newsSubject = cleanNewsSubject(input.newsSubject ?? ""), newsBody = cleanNewsBody(input.newsBody ?? "");
    if (newsSubject.length < 3 || newsSubject.length > NEWS_SUBJECT_MAX || newsBody.length < 10 || newsBody.length > NEWS_BODY_MAX) throw new Error("NEWS_CONTENT_INVALID");
    if (input.newsCtaUrl) {
      target = link(input.newsCtaUrl); action = "Saiba mais";
      if (new URL(target).origin !== new URL(unsubscribe).origin) throw new Error("CAMPAIGN_ORIGIN_MISMATCH");
    }
    subject = newsSubject;
    body = `Olá, ${name}!\n\n${newsBody}`;
  } else {
    if (!input.presaleApproved || !input.saleUrl) throw new Error("PRESALE_APPROVAL_REQUIRED");
    target = link(input.saleUrl); action = "Conhecer os planos";
    if (new URL(target).origin !== new URL(unsubscribe).origin) throw new Error("CAMPAIGN_ORIGIN_MISMATCH");
    subject = "A pré-venda do Inst Acessor está aberta";
    body = `Olá, ${name}! A pré-venda do Inst Acessor está aberta. Você demonstrou interesse no plano ${interest}. Conheça os planos e confira as condições disponíveis no nosso site oficial.`;
  }
  const footerText = `Não quer receber novos avisos? Cancele sua inscrição: ${unsubscribe}${preferences ? `\nEscolha os canais (email/WhatsApp): ${preferences}` : ""}`;
  const text = `${body}${target ? `\n\n${action}: ${target}` : ""}\n\n${footerText}`;
  const paragraphs = body.split(/\n{2,}/).map(part => `<p style="font-size:16px;line-height:1.7">${esc(part).replace(/\n/g, "<br/>")}</p>`).join("");
  const footerHtml = `<p style="font-size:13px;line-height:1.7"><a href="${esc(unsubscribe)}" style="color:#596579">Cancelar inscrição e avisos</a>${preferences ? ` · <a href="${esc(preferences)}" style="color:#596579">Gerenciar preferências</a>` : ""}</p>`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="referrer" content="no-referrer"/></head><body style="margin:0;background:#f7f8fa;color:#111318;font-family:Arial,sans-serif"><table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:24px 16px"><table role="presentation" style="width:100%;max-width:600px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px"><tr><td style="padding:28px"><p style="color:#6d28d9;font-size:16px;font-weight:bold">Inst Acessor</p><h1 style="font-size:24px;line-height:1.3">${esc(subject)}</h1>${paragraphs}${target ? `<p><a href="${esc(target)}" style="display:inline-block;background:#6d28d9;color:#fff;padding:14px 20px;border-radius:12px;text-decoration:none;font-weight:bold">${esc(action!)}</a></p>` : ""}${footerHtml}</td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}
