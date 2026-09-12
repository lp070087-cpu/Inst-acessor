"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { signIn } from "next-auth/react";
import {
  Loader2,
  Eye,
  EyeOff,
  Mail,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Lock,
  Link2,
  Zap,
  Compass,
  BarChart3,
  CalendarClock,
  BellRing,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type Stage =
  | "email"
  | "link-sent"
  | "password"
  | "congrats"
  | "tour"
  | "error";

interface GrantInfo {
  email: string;
  planName: string | null;
  origin: string;
  startAt: string | null;
  expiresAt: string | null;
  status: string;
}

const TOUR_STEPS = [
  {
    icon: Compass,
    title: "Visão geral do dashboard",
    body: "Acompanhe suas métricas do Instagram em um só lugar: seguidores, engajamento, alcance e evolução ao longo do tempo.",
  },
  {
    icon: Zap,
    title: "Planos e ações",
    body: "Transforme números em estratégia: o Inst Acessor sugere planos semanais e ações práticas para crescer com consistência.",
  },
  {
    icon: BarChart3,
    title: "Análise de desempenho",
    body: "Compare períodos, entenda o que funcionou e receba alertas inteligentes sobre mudanças importantes no seu perfil.",
  },
  {
    icon: CalendarClock,
    title: "Calendário de conteúdo",
    body: "Planeje, agende e publique posts direto do Inst Acessor, mantendo uma rotina constante de conteúdo.",
  },
  {
    icon: BellRing,
    title: "Alertas e insights",
    body: "Receba recomendações baseadas em dados reais do seu perfil e evolua seu jogo dia após dia.",
  },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function FirstAccessFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const urlToken = searchParams.get("token") ?? "";

  const [stage, setStage] = React.useState<Stage>(urlToken ? "password" : "email");
  const [email, setEmail] = React.useState("");
  const [token, setToken] = React.useState(urlToken);
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [grant, setGrant] = React.useState<GrantInfo | null>(null);
  const [userExists, setUserExists] = React.useState(false);
  const [tourStep, setTourStep] = React.useState(0);
  const [transitioning, setTransitioning] = React.useState(false);

  const planPeriod = grant?.startAt && grant?.expiresAt
    ? `${formatDate(grant.startAt)} → ${formatDate(grant.expiresAt)}`
    : null;

  /** Etapa 1 — solicita o link de primeiro acesso. */
  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/first-access/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      // Resposta sempre genérica (anti-enumeração).
      if (res.ok && data.dev?.activationUrl) {
        // Em dev, já segue para a criação de senha com o link de teste.
        setToken(data.dev.activationUrl.split("token=")[1] ?? "");
        setStage("password");
        toast("Link gerado em modo de desenvolvimento.", "info");
      } else {
        setStage("link-sent");
      }
    } catch {
      setError("Não foi possível processar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  /** Verifica o token (vindo da URL ou recém-gerado em dev). */
  async function verifyToken(t: string): Promise<boolean> {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/first-access/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Link inválido.");
        setStage("error");
        return false;
      }
      setEmail(data.email ?? "");
      setUserExists(Boolean(data.userExists));
      setGrant(data.grant ?? null);
      return true;
    } catch {
      setError("Não foi possível validar o link.");
      setStage("error");
      return false;
    } finally {
      setLoading(false);
    }
  }

  /** Ao montar com token na URL, valida automaticamente. */
  React.useEffect(() => {
    if (urlToken) {
      void verifyToken(urlToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Etapa 3 — cria a senha (bcrypt) e finaliza o primeiro acesso. */
  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/first-access/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
          confirmPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível ativar seu acesso.");
        return;
      }

      // Login automático com as credenciais recém-criadas.
      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInRes?.error) {
        // Conta criada mas falha no auto-login → usuário entra manualmente.
        toast("Conta criada! Faça login para continuar.", "success");
        router.push("/login");
        router.refresh();
        return;
      }

      setStage("congrats");
    } catch {
      setError("Não foi possível ativar seu acesso. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  /** CTA "Conhecer o Inst Acessor" → tour guiado. */
  function handleStartTour() {
    setStage("tour");
    setTourStep(0);
  }

  /** Avança/volta no tour. */
  function goTourStep(next: number) {
    setTransitioning(true);
    window.setTimeout(() => {
      setTourStep(next);
      setTransitioning(false);
    }, 200);
  }

  /** Finaliza o tour (marca conclusão) e segue para o onboarding. */
  async function handleFinishTour() {
    setLoading(true);
    try {
      await fetch("/api/first-access/tour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {
      /* tour opcional — não bloqueia */
    } finally {
      setLoading(false);
      // Onboarding step-by-step existente (não duplica o fluxo).
      router.push("/onboarding");
      router.refresh();
    }
  }

  const step = TOUR_STEPS[tourStep];

  if (stage === "link-sent") {
    return (
      <div className="flex flex-col items-center gap-4 text-center py-6">
        <span className="grid w-14 h-14 place-items-center rounded-[18px] bg-brand-grad text-white shadow-brand">
          <Mail size={26} strokeWidth={1.8} />
        </span>
        <h2 className="font-display text-[20px] font-bold text-ink">
          Verifique seu e-mail
        </h2>
        <p className="text-[13.5px] text-ink-soft leading-relaxed max-w-[340px]">
          Se houver uma liberação de acesso para <strong>{email}</strong>,
          enviaremos um link seguro de ativação. Ele é válido por{" "}
          <strong>60 minutos</strong> e pode ser usado apenas uma vez.
        </p>
        <p className="text-[12.5px] text-ink-muted max-w-[340px]">
          Não recebeu? Confira a caixa de spam ou{" "}
          <button
            type="button"
            onClick={() => setStage("email")}
            className="font-semibold text-purple hover:text-indigo cursor-pointer"
          >
            tente novamente
          </button>
          .
        </p>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="flex flex-col items-center gap-4 text-center py-6">
        <span className="grid w-14 h-14 place-items-center rounded-[18px] bg-danger/10 text-danger">
          <ShieldCheck size={26} strokeWidth={1.8} />
        </span>
        <h2 className="font-display text-[20px] font-bold text-ink">
          Link inválido ou expirado
        </h2>
        <p className="text-[13.5px] text-ink-soft leading-relaxed max-w-[340px]">
          {error ?? "Este link de ativação não é válido."}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setError(null);
            setStage("email");
          }}
        >
          <ArrowLeft size={16} /> Solicitar novo link
        </Button>
      </div>
    );
  }

  if (stage === "congrats") {
    return (
      <div className="flex flex-col items-center gap-4 text-center py-4">
        <span className="grid w-16 h-16 place-items-center rounded-full bg-success/10 text-success">
          <CheckCircle2 size={34} strokeWidth={1.6} />
        </span>
        <h2 className="font-display text-[22px] font-bold text-ink">
          Parabéns! Acesso ativado
        </h2>
        <p className="text-[13.5px] text-ink-soft leading-relaxed max-w-[360px]">
          Sua conta foi criada com o e-mail <strong>{email}</strong>. Agora você
          faz parte do Inst Acessor.
        </p>

        {grant && (
          <div className="w-full rounded-[14px] border border-border bg-bg-ice/60 p-4 mt-2 text-left">
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <p className="text-ink-muted">Plano</p>
                <p className="font-semibold text-ink mt-0.5">
                  {grant.planName ?? "Inst Acessor"}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Origem</p>
                <p className="font-semibold text-ink mt-0.5">
                  {grant.origin === "ASAAS" || grant.origin === "INFINITEPAY" ? "Compra" : "Liberação manual"}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Início</p>
                <p className="font-semibold text-ink mt-0.5">
                  {formatDate(grant.startAt)}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Válido até</p>
                <p className="font-semibold text-ink mt-0.5">
                  {formatDate(grant.expiresAt)}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="w-full mt-3">
          <Button type="button" size="lg" block onClick={handleStartTour}>
            <Sparkles size={18} /> Conhecer o Inst Acessor
          </Button>
        </div>
        <p className="text-[12.5px] text-ink-muted">
          Ou{" "}
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="font-semibold text-purple hover:text-indigo cursor-pointer"
          >
            ir direto ao painel
          </button>
        </p>
      </div>
    );
  }

  if (stage === "tour") {
    return (
      <div className="flex flex-col items-center gap-4 text-center py-4">
        <div className="flex items-center gap-1.5 mb-1">
          {TOUR_STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === tourStep ? "w-7 bg-brand-grad" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>

        <span className="grid w-16 h-16 place-items-center rounded-[22px] bg-brand-grad text-white shadow-brand">
          <step.icon size={30} strokeWidth={1.6} />
        </span>

        <div className={transitioning ? "opacity-0 translate-y-1 transition-all duration-200" : "opacity-100 transition-all duration-200"}>
          <h2 className="font-display text-[21px] font-bold text-ink">
            {step.title}
          </h2>
          <p className="text-[13.5px] text-ink-soft leading-relaxed max-w-[360px] mt-2">
            {step.body}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full mt-3">
          {tourStep > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => goTourStep(tourStep - 1)}
              disabled={loading}
            >
              <ArrowLeft size={16} /> Voltar
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={handleFinishTour}
              disabled={loading}
            >
              Pular tour
            </Button>
          )}

          {tourStep < TOUR_STEPS.length - 1 ? (
            <Button
              type="button"
              size="md"
              block
              onClick={() => goTourStep(tourStep + 1)}
            >
              Próximo <ArrowRight size={16} />
            </Button>
          ) : (
            <Button
              type="button"
              size="md"
              block
              onClick={handleFinishTour}
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Começar"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // stage === "password"
  return (
    <form onSubmit={handleCreateAccount} className="flex flex-col gap-5" noValidate>
      <div className="rounded-[12px] border border-border bg-bg-ice/60 px-4 py-3 flex items-center gap-3">
        <span className="grid w-9 h-9 place-items-center rounded-[10px] bg-brand-grad text-white shrink-0">
          <Mail size={17} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-[12.5px] text-ink-soft">Ativando acesso para</p>
          <p className="text-[14px] font-semibold text-ink truncate">
            {email || "seu e-mail"}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-[12px] bg-danger-softStrong border border-danger/20 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="fa-password"
            className="text-[13px] font-semibold text-ink"
          >
            Crie sua senha
          </label>
          <span className="text-[11.5px] text-ink-muted">mín. 8 caracteres</span>
        </div>
        <div className="relative">
          <input
            id="fa-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Sua senha segura"
            className="h-12 w-full rounded-[12px] border border-border bg-bg-ice pr-12 pl-4 text-[14.5px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow"
            required
            minLength={8}
          />
          <button
            type="button"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-0 top-0 grid h-12 w-12 place-items-center text-ink-soft hover:text-purple transition-colors cursor-pointer"
          >
            {showPassword ? (
              <EyeOff size={19} strokeWidth={1.8} />
            ) : (
              <Eye size={19} strokeWidth={1.8} />
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="fa-confirm"
          className="text-[13px] font-semibold text-ink"
        >
          Confirme sua senha
        </label>
        <div className="relative">
          <input
            id="fa-confirm"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repita sua senha"
            className="h-12 w-full rounded-[12px] border border-border bg-bg-ice pr-12 pl-4 text-[14.5px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow"
            required
            minLength={8}
          />
          <button
            type="button"
            aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-0 top-0 grid h-12 w-12 place-items-center text-ink-soft hover:text-purple transition-colors cursor-pointer"
          >
            {showConfirm ? (
              <EyeOff size={19} strokeWidth={1.8} />
            ) : (
              <Eye size={19} strokeWidth={1.8} />
            )}
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2.5 text-[12.5px] text-ink-muted">
        <Lock size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-purple" />
        <p>
          Sua senha é salva com criptografia forte (bcrypt). O Inst Acessor
          nunca tem acesso à sua senha em texto puro.
        </p>
      </div>

      <Button type="submit" size="lg" block disabled={loading}>
        {loading ? <Loader2 size={18} className="animate-spin" /> : null}
        {loading ? "Ativando..." : "Ativar meu acesso"}
      </Button>

      {!urlToken && (
        <button
          type="button"
          onClick={() => setStage("email")}
          className="text-[13px] text-ink-soft hover:text-purple transition-colors cursor-pointer self-center"
        >
          Usar outro e-mail
        </button>
      )}
    </form>
  );
}

export function FirstAccessForm() {
  return (
    <Suspense fallback={null}>
      <FirstAccessFormInner />
    </Suspense>
  );
}
