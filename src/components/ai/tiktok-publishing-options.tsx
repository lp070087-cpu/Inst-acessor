"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { tiktokPublishingIssue, type TikTokCreatorInfo, type TikTokPublishingOptions } from "@/lib/integrations/tiktok/creator-info";

const privacyLabels = { PUBLIC_TO_EVERYONE: "Todos", MUTUAL_FOLLOW_FRIENDS: "Amigos", FOLLOWER_OF_CREATOR: "Seguidores", SELF_ONLY: "Somente eu" };
interface Props {
  videoUrl: string;
  contentBinding: string;
  initialOptions?: TikTokPublishingOptions;
  onChange: (value: TikTokPublishingOptions | undefined) => void;
}

/** Requests current capabilities only through the authenticated, disabled-by-default
 * server route. Nothing is uploaded to TikTok by this component. */
export function TikTokPublishingOptionsPanel({ videoUrl, contentBinding, initialOptions, onChange }: Props) {
  const [creator, setCreator] = React.useState<TikTokCreatorInfo>();
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [privacy, setPrivacy] = React.useState<TikTokPublishingOptions["privacy"] | "">(initialOptions?.privacy ?? "");
  const [allowComment, setComment] = React.useState(false);
  const [allowDuet, setDuet] = React.useState(false);
  const [allowStitch, setStitch] = React.useState(false);
  const [commercial, setCommercial] = React.useState(false);
  const [ownBrand, setOwnBrand] = React.useState(false);
  const [thirdPartyBrand, setThirdPartyBrand] = React.useState(false);
  const [aiGenerated, setAiGenerated] = React.useState(initialOptions?.aiGenerated ?? false);
  const [music, setMusic] = React.useState(false);
  const [brandedPolicy, setBrandedPolicy] = React.useState(false);
  const [uploadConsent, setUploadConsent] = React.useState(false);
  const [durationSec, setDurationSec] = React.useState(0);
  const [refresh, setRefresh] = React.useState(0);
  const lastBinding = React.useRef(contentBinding);
  const invalidate = () => { setMusic(false); setBrandedPolicy(false); setUploadConsent(false); };

  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setMessage(""); setCreator(undefined); onChange(undefined);
    setMusic(false); setBrandedPolicy(false); setUploadConsent(false);
    void fetch("/api/integrations/tiktok/creator-info", { cache: "no-store", signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Não foi possível consultar a conta TikTok."); return data.creator as TikTokCreatorInfo; })
      .then(value => { if (!controller.signal.aborted) { setCreator(value); setPrivacy(current => value.privacyOptions.includes(current as TikTokPublishingOptions["privacy"]) ? current : ""); setComment(false); setDuet(false); setStitch(false); } })
      .catch((error: unknown) => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Conta TikTok indisponível."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh, onChange]);

  React.useEffect(() => {
    setDurationSec(0);
    if (!videoUrl) return;
    const video = document.createElement("video");
    video.preload = "metadata"; video.muted = true;
    const timer = setTimeout(() => setMessage("Não foi possível confirmar a duração do vídeo. Selecione um arquivo compatível."), 15000);
    video.onloadedmetadata = () => { clearTimeout(timer); if (Number.isFinite(video.duration) && video.duration > 0) setDurationSec(video.duration); else setMessage("O vídeo não informou uma duração válida."); };
    video.onerror = () => { clearTimeout(timer); setMessage("Não foi possível ler a duração do vídeo selecionado."); };
    video.src = videoUrl;
    return () => { clearTimeout(timer); video.onloadedmetadata = null; video.onerror = null; video.removeAttribute("src"); video.load(); };
  }, [videoUrl]);

  React.useEffect(() => {
    if (lastBinding.current === contentBinding) return;
    lastBinding.current = contentBinding;
    // Every content edit requires a new explicit consent. Saving the same file
    // under its durable URL is handled by the parent before persisting options.
    setMusic(false); setBrandedPolicy(false); setUploadConsent(false); onChange(undefined);
  }, [contentBinding, onChange]);

  React.useEffect(() => {
    if (!creator || !privacy || !music || !uploadConsent || !durationSec) { onChange(undefined); return; }
    const value: TikTokPublishingOptions = { version: 1, accountId: creator.accountId, privacy, allowComment, allowDuet, allowStitch,
      commercial, ownBrand, thirdPartyBrand, aiGenerated, durationSec, contentBinding, musicConsent: true,
      brandedPolicyConsent: brandedPolicy, uploadConsent: true, consentAt: new Date().toISOString() };
    const issue = tiktokPublishingIssue(value, creator, contentBinding);
    if (issue) { onChange(undefined); return; }
    onChange(value);
  }, [creator, privacy, music, uploadConsent, durationSec, allowComment, allowDuet, allowStitch, commercial, ownBrand, thirdPartyBrand, aiGenerated, contentBinding, brandedPolicy, onChange]);

  const stale = creator ? Date.now() - Date.parse(creator.fetchedAt) > 5 * 60_000 : true;
  const tooLong = !!creator && durationSec > creator.maxDurationSec;
  return <section aria-label="Opções de publicação TikTok" className="grid gap-3 rounded-xl border border-border bg-surface p-4">
    <h3 className="font-semibold">Publicar no TikTok</h3>
    {loading && <p role="status">Consultando as opções atuais da sua conta…</p>}
    {message && <p role="status" className="break-words text-sm">{message}</p>}
    {!creator && !loading && <a className="text-sm underline" href="/api/integrations/tiktok/connect?publishing=1">Autorizar permissão de publicação no TikTok</a>}
    {creator && <>
      <p className="text-sm">Conta: <strong>{creator.nickname}</strong> (@{creator.username})</p>
      {!creator.audited && <p className="text-xs text-ink-muted">Este ambiente permite somente teste privado. A aprovação do aplicativo TikTok continua necessária.</p>}
      <p className="text-xs text-ink-muted">Vídeo: {durationSec ? durationSec.toFixed(1) : "duração indisponível"} s · limite desta conta: {creator.maxDurationSec} s.</p>
      {tooLong && <p role="alert" className="text-sm">Reduza o vídeo antes de publicar: a duração excede o limite da conta.</p>}
      <fieldset disabled={loading || stale || tooLong} className="grid gap-3 disabled:opacity-60">
        <label className="grid gap-1 text-sm">Quem pode assistir<select className="min-w-0 rounded-lg border border-border bg-surface p-2" value={privacy} onChange={event => { setPrivacy(event.target.value as typeof privacy); invalidate(); }}><option value="">Selecione a privacidade</option>{creator.privacyOptions.map(option => <option key={option} value={option} disabled={thirdPartyBrand && option === "SELF_ONLY"}>{privacyLabels[option]}</option>)}</select></label>
        {([ ["Permitir comentários", allowComment, creator.commentDisabled, setComment], ["Permitir Dueto", allowDuet, creator.duetDisabled, setDuet], ["Permitir Costura", allowStitch, creator.stitchDisabled, setStitch] ] as const).map(([label, checked, disabled, setter]) => <label key={label} className={`flex items-start gap-2 text-sm ${disabled ? "opacity-50" : ""}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={event => { setter(event.target.checked); invalidate(); }} />{label}{disabled && " (desativado na conta)"}</label>)}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={commercial} onChange={event => { setCommercial(event.target.checked); setOwnBrand(false); setThirdPartyBrand(false); invalidate(); }} />Divulgar conteúdo comercial</label>
        {commercial && <div className="grid gap-2 rounded-lg border border-border p-3">
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={ownBrand} onChange={event => { setOwnBrand(event.target.checked); invalidate(); }} />Sua marca</label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={thirdPartyBrand} disabled={privacy === "SELF_ONLY"} onChange={event => { setThirdPartyBrand(event.target.checked); invalidate(); }} />Conteúdo de marca / parceria paga</label>
          {!ownBrand && !thirdPartyBrand && <p className="text-xs">Selecione sua marca, outra marca ou ambas para continuar.</p>}
          {privacy === "SELF_ONLY" && <p className="text-xs">Parceria paga não pode usar visibilidade Somente eu.</p>}
          {(ownBrand || thirdPartyBrand) && <p className="text-xs">O vídeo receberá o rótulo {thirdPartyBrand ? "Parceria paga" : "Conteúdo promocional"}.</p>}
        </div>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={aiGenerated} onChange={event => { setAiGenerated(event.target.checked); invalidate(); }} />Identificar conteúdo gerado por IA</label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={music} onChange={event => setMusic(event.target.checked)} />Ao publicar, concordo com a <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noreferrer" className="underline">Confirmação de Uso de Música do TikTok</a>.</label>
        {thirdPartyBrand && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={brandedPolicy} onChange={event => setBrandedPolicy(event.target.checked)} />Concordo também com a <a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noreferrer" className="underline">Política de Conteúdo de Marca</a>.</label>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={uploadConsent} onChange={event => setUploadConsent(event.target.checked)} />Revisei a prévia, a legenda, a conta e as opções acima. Autorizo o envio deste vídeo ao TikTok, agora ou no horário que eu programar.</label>
      </fieldset>
      {stale && <p role="status" className="text-sm">Atualize as opções da conta antes de confirmar o envio.</p>}
      <p className="text-xs text-ink-muted">Depois do envio, o processamento pode levar alguns minutos. Acompanhe o resultado na Central de Publicação.</p>
    </>}
    <Button type="button" variant="outline" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Atualizar opções TikTok</Button>
  </section>;
}
