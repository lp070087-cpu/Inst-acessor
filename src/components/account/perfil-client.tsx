"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Loader2,
  Check,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Instagram,
  Music2,
  ExternalLink,
  KeyRound,
  Info,
} from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * PERFIL DA CONTA — cliente
 * ==========================
 * Edita os dados REAIS da conta (os mesmos que a sidebar e o Rank usam):
 * foto, nome, nome de exibição, @ do perfil público, nicho, subnicho e objetivo.
 *
 * Decisões que aparecem no código:
 *
 *  • E-MAIL É SOMENTE LEITURA. O projeto não tem fluxo de verificação de posse
 *    do e-mail (nada de confirmação por link no e-mail novo). Deixar trocar o
 *    e-mail direto permitiria tomar a conta. Então ele aparece, mas não é
 *    editável — e a tela explica isso em vez de esconder o campo.
 *
 *  • SENHA SÓ EXISTE DE VERDADE. Até este bloco o app não tinha troca de senha.
 *    O formulário abaixo fala com `/api/account/password`, que EXIGE a senha
 *    atual. Nada aqui é botão decorativo.
 *
 *  • A FOTO NÃO VEM DO INSTAGRAM. A foto da conta é gravada em
 *    `UserProfile.avatar`; a do Instagram conectado continua na integração e é
 *    exibida no card de Redes Sociais. Nunca copiamos uma na outra.
 *
 *  • PATCH PARCIAL. `save()` envia SOMENTE os campos que o usuário alterou
 *    (`dirty`). Assim um campo que a tela não mexeu jamais vira `null` por
 *    omissão — a rota diferencia "não enviado" de "limpo pelo usuário".
 */

export interface PerfilAccount {
  name: string | null;
  email: string;
  avatar: string | null;
  displayName: string | null;
  username: string | null;
  niche: string | null;
  subNiche: string | null;
  objective: string | null;
  createdAt: string;
}

export interface PerfilConnection {
  platform: "instagram" | "tiktok";
  connected: boolean;
  username: string | null;
  avatarUrl: string | null;
  /** Texto de frescor já calculado no servidor a partir de `lastSyncAt`. */
  syncLabel: string | null;
  syncStale: boolean;
}

interface PerfilClientProps {
  account: PerfilAccount;
  connections: PerfilConnection[];
  /** Já existe uma senha definida? (conta criada por webhook pode não ter) */
  hasPassword: boolean;
  /** Aceita WEBP? Hoje não — mantido explícito para a UI avisar com precisão. */
  acceptsWebp: boolean;
}

/** Campos de texto editáveis — o resto é somente leitura. */
type TextField = "name" | "displayName" | "username" | "niche" | "subNiche" | "objective";

const OBJECTIVES = [
  "Crescer seguidores",
  "Aumentar engajamento",
  "Vender mais",
  "Gerar autoridade",
  "Atrair clientes",
];

/**
 * Reduz e reencoda a imagem no NAVEGADOR antes de subir.
 *
 * Por que: o que é gravado no banco é um data URL, então o arquivo precisa ser
 * pequeno. Redimensionar aqui (256px, JPEG) mantém o avatar leve e legível; sem
 * isso, uma foto de celular de 4 MB estouraria o teto do servidor.
 *
 * PNG com transparência é reencodado em JPEG sobre fundo branco (sem isso a
 * área transparente viraria preta no JPEG).
 */
const AVATAR_DIMENSION = 256;
const AVATAR_QUALITY = 0.85;

function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode"));
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = AVATAR_DIMENSION;
          canvas.height = AVATAR_DIMENSION;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("canvas"));
            return;
          }
          // Fundo branco: evita borda preta quando a origem tem transparência.
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, AVATAR_DIMENSION, AVATAR_DIMENSION);

          // Recorte quadrado central (cover), para não distorcer o rosto.
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_DIMENSION, AVATAR_DIMENSION);

          resolve(canvas.toDataURL("image/jpeg", AVATAR_QUALITY));
        } catch {
          reject(new Error("encode"));
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function PerfilClient({
  account,
  connections,
  hasPassword,
  acceptsWebp,
}: PerfilClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  // ---- Estado do formulário ----
  const [form, setForm] = React.useState<Record<TextField, string>>({
    name: account.name ?? "",
    displayName: account.displayName ?? "",
    username: account.username ?? "",
    niche: account.niche ?? "",
    subNiche: account.subNiche ?? "",
    objective: account.objective ?? "",
  });

  /**
   * Campos que o usuário REALMENTE alterou. É o que define o corpo do PATCH —
   * o que não está aqui não é enviado, e portanto não é sobrescrito no banco.
   */
  const [dirty, setDirty] = React.useState<Set<TextField>>(new Set());
  const [saving, setSaving] = React.useState(false);

  // ---- Estado da foto ----
  const [avatar, setAvatar] = React.useState<string | null>(account.avatar);
  const [avatarBusy, setAvatarBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // ---- Estado da senha ----
  const [pwdOpen, setPwdOpen] = React.useState(false);
  const [pwd, setPwd] = React.useState({ currentPassword: "", password: "", confirmPassword: "" });
  const [pwdShow, setPwdShow] = React.useState(false);
  const [pwdBusy, setPwdBusy] = React.useState(false);
  const [pwdError, setPwdError] = React.useState<string | null>(null);

  const hasChanges = dirty.size > 0;

  function setField(field: TextField, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty((prev) => {
      const next = new Set(prev);
      next.add(field);
      return next;
    });
  }

  /** Descarta as edições locais e volta ao que está gravado no servidor. */
  function resetForm() {
    setForm({
      name: account.name ?? "",
      displayName: account.displayName ?? "",
      username: account.username ?? "",
      niche: account.niche ?? "",
      subNiche: account.subNiche ?? "",
      objective: account.objective ?? "",
    });
    setDirty(new Set());
  }

  // ------------------------------------------------------------
  // Salvar alterações
  // ------------------------------------------------------------
  async function save() {
    if (!hasChanges || saving) return;

    // Monta APENAS os campos tocados. String vazia = o usuário limpou o campo
    // de propósito (vira null no servidor, exceto nos obrigatórios).
    const payload: Record<string, string> = {};
    for (const field of dirty) payload[field] = form[field];

    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        user?: { name: string | null };
        profile?: {
          displayName: string | null;
          username: string | null;
          niche: string | null;
          subNiche: string | null;
          objective: string | null;
        };
      };

      if (!res.ok) {
        toast(data.error ?? "Não foi possível salvar suas alterações.", "error");
        return;
      }

      // Revalida com o que o SERVIDOR gravou (fonte da verdade), não com o que
      // foi digitado — assim o @ normalizado aparece já corrigido.
      setForm({
        name: data.user?.name ?? "",
        displayName: data.profile?.displayName ?? "",
        username: data.profile?.username ?? "",
        niche: data.profile?.niche ?? "",
        subNiche: data.profile?.subNiche ?? "",
        objective: data.profile?.objective ?? "",
      });
      setDirty(new Set());
      toast("Alterações salvas.");
      // Nome/avatar aparecem na sidebar e no cabeçalho: revalida o servidor.
      router.refresh();
    } catch {
      toast("Não foi possível conectar. Verifique sua internet.", "error");
    } finally {
      setSaving(false);
    }
  }

  // ------------------------------------------------------------
  // Foto
  // ------------------------------------------------------------
  async function onPickFile(file: File | undefined) {
    if (!file) return;

    // Recusa clara ANTES de processar: tipo e vazio. O servidor valida de novo
    // pelos magic bytes — isto aqui é só para dar resposta imediata.
    const allowed = ["image/png", "image/jpeg"];
    if (file.type === "image/webp" && !acceptsWebp) {
      toast("Imagens WEBP ainda não são aceitas. Envie um arquivo PNG ou JPG.", "error");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (!allowed.includes(file.type)) {
      toast("Formato não aceito. Envie um arquivo PNG ou JPG.", "error");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (file.size === 0) {
      toast("O arquivo enviado está vazio.", "error");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setAvatarBusy(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);

      const res = await fetch("/api/account/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = (await res.json()) as { ok?: boolean; avatar?: string; error?: string };

      if (!res.ok || !data.ok) {
        toast(data.error ?? "Não foi possível salvar sua foto.", "error");
        return;
      }

      setAvatar(data.avatar ?? dataUrl);
      toast("Foto atualizada.");
      router.refresh();
    } catch {
      toast("Não foi possível processar essa imagem. Tente outro arquivo.", "error");
    } finally {
      setAvatarBusy(false);
      // Permite escolher o MESMO arquivo de novo depois de limpar.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    try {
      const res = await fetch("/api/account/avatar", { method: "DELETE" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast(data.error ?? "Não foi possível remover sua foto.", "error");
        return;
      }
      setAvatar(null);
      toast("Foto removida. Suas iniciais voltaram a aparecer.");
      router.refresh();
    } catch {
      toast("Não foi possível remover sua foto.", "error");
    } finally {
      setAvatarBusy(false);
    }
  }

  // ------------------------------------------------------------
  // Senha
  // ------------------------------------------------------------
  async function changePassword() {
    if (pwdBusy) return;
    setPwdError(null);

    if (!pwd.currentPassword) {
      setPwdError("Informe sua senha atual.");
      return;
    }
    if (pwd.password.length < 8) {
      setPwdError("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (pwd.password !== pwd.confirmPassword) {
      setPwdError("As senhas não coincidem.");
      return;
    }

    setPwdBusy(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pwd),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        setPwdError(data.error ?? "Não foi possível alterar sua senha.");
        return;
      }

      setPwd({ currentPassword: "", password: "", confirmPassword: "" });
      setPwdOpen(false);
      toast("Senha alterada.");
    } catch {
      setPwdError("Não foi possível conectar. Verifique sua internet.");
    } finally {
      setPwdBusy(false);
    }
  }

  const createdLabel = new Date(account.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      {/* ================= Identidade da conta ================= */}
      <section className="bg-card border border-border-soft rounded-lg shadow-xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Foto + ações */}
          {/* BLOCO 5 — em 320px o avatar (80px) somado aos dois botões
              ("Alterar foto" + "Remover foto") não cabia lado a lado e empurrava
              a linha. `flex-wrap` deixa os botões descerem; `min-w-0` no bloco
              de botões evita que o rótulo force a largura. */}
          <div className="flex items-center gap-4 flex-wrap sm:flex-col sm:items-start min-w-0">
            <div className="relative">
              <Avatar
                name={form.name || account.name}
                src={avatar}
                size="lg"
                className="w-20 h-20 text-[24px]"
              />
              {avatarBusy && (
                <span className="absolute inset-0 grid place-items-center rounded-full bg-ink/40">
                  <Loader2 size={20} className="animate-spin text-white" />
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept={acceptsWebp ? "image/png,image/jpeg,image/webp" : "image/png,image/jpeg"}
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={avatarBusy}
                onClick={() => fileRef.current?.click()}
                className="gap-2"
              >
                <Camera size={15} />
                {avatar ? "Alterar foto" : "Adicionar foto"}
              </Button>
              {avatar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={avatarBusy}
                  onClick={removeAvatar}
                  className="gap-2 text-ink-muted"
                >
                  <Trash2 size={14} />
                  Remover foto
                </Button>
              )}
            </div>
          </div>

          {/* Nome + e-mail */}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[20px] font-bold text-ink truncate">
              {form.name.trim() || account.name || "Minha conta"}
            </h2>
            {/* BLOCO 5 — aqui `truncate` é aceitável: o e-mail longo continua
                legível por completo no bloco "Conta e segurança" logo abaixo. */}
            <p className="text-[13.5px] text-ink-soft truncate">{account.email}</p>
            <p className="text-[12.5px] text-ink-muted mt-1">
              Conta do Inst Acessor desde {createdLabel}.
            </p>

            <p className="inline-flex items-start gap-2 text-[12.5px] text-ink-muted mt-3">
              <Info size={14} className="flex-none mt-0.5" />
              <span>
                Aceita PNG e JPG. A imagem é reduzida automaticamente e, sem foto,
                aparecem as iniciais do seu nome.
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* ================= Dados editáveis ================= */}
      <section className="bg-card border border-border-soft rounded-lg shadow-xs p-6">
        <h3 className="font-display text-[17px] font-bold text-ink">Seus dados</h3>
        <p className="text-[13px] text-ink-soft mt-1">
          Estas informações são usadas pela IA Acessor e pelo seu perfil público.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
          <Field
            label="Nome"
            hint="Como você é chamado no aplicativo."
            value={form.name}
            maxLength={120}
            onChange={(v) => setField("name", v)}
          />
          <Field
            label="Nome de exibição"
            hint="Aparece no Rank e no seu perfil público. Vazio = usa o seu nome."
            value={form.displayName}
            maxLength={60}
            onChange={(v) => setField("displayName", v)}
          />
          <Field
            label="@ do perfil público"
            hint="Endereço do seu perfil em /p/. Letras, números, ponto e underline."
            value={form.username}
            maxLength={30}
            prefix="@"
            onChange={(v) => setField("username", v)}
          />
          <Field
            label="Objetivo"
            hint="O que você quer alcançar com o Inst Acessor."
            value={form.objective}
            maxLength={60}
            options={OBJECTIVES}
            onChange={(v) => setField("objective", v)}
          />
          <Field
            label="Nicho"
            hint="Sua área de atuação."
            value={form.niche}
            maxLength={80}
            onChange={(v) => setField("niche", v)}
          />
          <Field
            label="Subnicho"
            hint="Opcional — para afinar o seu nicho."
            value={form.subNiche}
            maxLength={80}
            onChange={(v) => setField("subNiche", v)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-6">
          <Button onClick={save} disabled={!hasChanges || saving} className="gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
          {hasChanges && !saving && (
            <Button variant="ghost" onClick={resetForm}>
              Descartar
            </Button>
          )}
          {hasChanges && (
            <span className="text-[12.5px] text-ink-muted">
              Você tem alterações não salvas.
            </span>
          )}
        </div>
      </section>

      {/* ================= Conta e segurança ================= */}
      <section className="bg-card border border-border-soft rounded-lg shadow-xs p-6">
        <h3 className="font-display text-[17px] font-bold text-ink">Conta e segurança</h3>

        <div className="mt-5 flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
            E-mail
          </span>
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            {/* BLOCO 5 — e-mail longo. Um endereço sem espaço quebrável
                (`nome.sobrenome.muito.longo@dominio.com.br`) não tem onde
                quebrar e alarga a linha inteira. `min-w-0` deixa o item
                encolher e `[overflow-wrap:anywhere]` permite a quebra no
                meio da palavra, mantendo o "Somente leitura" ao lado. */}
            <span className="text-[14.5px] text-ink min-w-0 [overflow-wrap:anywhere]">
              {account.email}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-ink-muted">
              <Lock size={12} />
              Somente leitura
            </span>
          </div>
          <p className="text-[12.5px] text-ink-muted max-w-[62ch]">
            O e-mail identifica sua conta e sua assinatura. Para alterá-lo é
            necessária uma confirmação no endereço novo — recurso ainda não
            disponível. Assim evitamos que alguém assuma a sua conta.
          </p>
        </div>

        <Divider className="my-5" />

        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-[10px] bg-surface grid place-items-center text-ink-soft flex-none">
              <KeyRound size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-ink">Senha</p>
              <p className="text-[12.5px] text-ink-muted">
                {hasPassword
                  ? "Você pode alterar sua senha informando a senha atual."
                  : "Sua conta ainda não tem senha definida."}
              </p>
            </div>
          </div>

          {hasPassword ? (
            pwdOpen ? (
              <div className="rounded-md border border-border-soft bg-surface/40 p-4 flex flex-col gap-3">
                <PasswordInput
                  label="Senha atual"
                  value={pwd.currentPassword}
                  show={pwdShow}
                  onChange={(v) => setPwd((p) => ({ ...p, currentPassword: v }))}
                />
                <PasswordInput
                  label="Nova senha"
                  hint="Mínimo de 8 caracteres."
                  value={pwd.password}
                  show={pwdShow}
                  onChange={(v) => setPwd((p) => ({ ...p, password: v }))}
                />
                <PasswordInput
                  label="Confirmar nova senha"
                  value={pwd.confirmPassword}
                  show={pwdShow}
                  onChange={(v) => setPwd((p) => ({ ...p, confirmPassword: v }))}
                />

                <button
                  type="button"
                  onClick={() => setPwdShow((s) => !s)}
                  className="self-start inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-muted hover:text-ink cursor-pointer"
                >
                  {pwdShow ? <EyeOff size={14} /> : <Eye size={14} />}
                  {pwdShow ? "Ocultar senhas" : "Mostrar senhas"}
                </button>

                {pwdError && (
                  <p className="inline-flex items-start gap-2 text-[13px] text-danger">
                    <AlertTriangle size={15} className="flex-none mt-0.5" />
                    {pwdError}
                  </p>
                )}

                <div className="flex flex-wrap gap-2.5">
                  <Button onClick={changePassword} disabled={pwdBusy} size="sm" className="gap-2">
                    {pwdBusy ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Check size={15} />
                    )}
                    {pwdBusy ? "Alterando..." : "Alterar senha"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pwdBusy}
                    onClick={() => {
                      setPwdOpen(false);
                      setPwdError(null);
                      setPwd({ currentPassword: "", password: "", confirmPassword: "" });
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="self-start gap-2"
                onClick={() => setPwdOpen(true)}
              >
                <KeyRound size={15} />
                Alterar senha
              </Button>
            )
          ) : (
            <p className="text-[13px] text-ink-soft">
              Conclua o primeiro acesso para criar sua senha e poder alterá-la depois.
            </p>
          )}
        </div>
      </section>

      {/* ================= Redes conectadas (só leitura) ================= */}
      <section className="bg-card border border-border-soft rounded-lg shadow-xs p-6">
        <h3 className="font-display text-[17px] font-bold text-ink">Redes conectadas</h3>
        <p className="text-[13px] text-ink-soft mt-1">
          A foto e o nome das suas redes são da conta conectada — diferentes da foto
          e do nome desta conta.
        </p>

        <div className="flex flex-col gap-3 mt-5">
          {connections.map((c) => {
            const Icon = c.platform === "instagram" ? Instagram : Music2;
            const label = c.platform === "instagram" ? "Instagram" : "TikTok";
            return (
              <div
                key={c.platform}
                className="flex items-center gap-3.5 rounded-md border border-border-soft px-4 py-3"
              >
                <Avatar
                  name={c.username ?? label}
                  src={c.connected ? c.avatarUrl : null}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-ink truncate">
                    {c.connected && c.username ? `@${c.username}` : label}
                  </p>
                  <p className="text-[12.5px] text-ink-muted truncate">
                    {c.connected
                      ? c.syncLabel ?? "Nenhuma sincronização de dados registrada ainda."
                      : "Não conectado"}
                  </p>
                </div>
                {/* Dado antigo é SINALIZADO, nunca apagado (regra dos Blocos 1/2). */}
                {c.connected && c.syncStale && (
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-warn flex-none">
                    <AlertTriangle size={13} />
                    Desatualizado
                  </span>
                )}
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-[12px] font-semibold flex-none",
                    c.connected ? "text-success" : "text-ink-muted"
                  )}
                >
                  <Icon size={14} />
                  {c.connected ? "Conectado" : "Desconectado"}
                </span>
              </div>
            );
          })}
        </div>

        <a
          href="/redes-sociais"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-purple hover:underline mt-4"
        >
          Gerenciar conexões
          <ExternalLink size={13} />
        </a>
      </section>
    </div>
  );
}

// ------------------------------------------------------------
// Campos
// ------------------------------------------------------------

function Field({
  label,
  hint,
  value,
  onChange,
  maxLength,
  prefix,
  options,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  prefix?: string;
  options?: readonly string[];
}) {
  const listId = React.useId();

  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
        {label}
      </span>

      <span className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-[14px] text-ink-muted pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="text"
          value={value}
          maxLength={maxLength}
          list={options ? listId : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full rounded-[10px] border border-border bg-bg-ice py-2.5 text-[14px] text-ink",
            "placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20",
            "focus:outline-none transition-shadow",
            prefix ? "pl-7 pr-3" : "px-3"
          )}
        />
      </span>

      {options && (
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}

      {hint && <span className="text-[12px] text-ink-muted">{hint}</span>}
    </label>
  );
}

function PasswordInput({
  label,
  hint,
  value,
  onChange,
  show,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
        {label}
      </span>
      <input
        type={show ? "text" : "password"}
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] border border-border bg-bg-ice px-3 py-2.5 text-[14px] text-ink focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow"
      />
      {hint && <span className="text-[12px] text-ink-muted">{hint}</span>}
    </label>
  );
}
