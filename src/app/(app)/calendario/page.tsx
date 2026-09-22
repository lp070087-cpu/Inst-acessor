import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";

import {
  requireOnboardedSession,
  requirePremiumPage,
} from "@/lib/auth/guard";
import { listPlannedContent, buildWeeklyPlan } from "@/lib/planning";
import { listIdeas } from "@/lib/ai/services";
import { listCopies } from "@/lib/ai/services";
import { listDrafts } from "@/lib/ai/services";
import { kb } from "@/lib/knowledge/repository";
import { listGoals } from "@/lib/gamification";
import { CalendarClient } from "@/components/planning/calendar-client";

export const metadata: Metadata = {
  title: "Calendário",
  description: "Planejamento, calendário e pipeline de conteúdo do Inst Acessor.",
};

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  // Módulo do plano: sem acesso premium, a própria página manda o usuário
  // para /acesso-restrito. A checagem vive na página (e não no layout)
  // porque só ela sabe a própria rota: não há header para ler nem um
  // valor que possa se perder no caminho.
  await requirePremiumPage();

  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  // Dados reais do planejamento + entidades associáveis (ideias/copies/drafts/experimentos/metas).
  const [contents, weekly, ideas, copies, drafts, experiments, goals] = await Promise.all([
    listPlannedContent(userId),
    buildWeeklyPlan(userId),
    listIdeas(userId),
    listCopies(userId),
    listDrafts(userId),
    kb.experiment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
    listGoals(userId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <CalendarDays size={26} className="text-purple" />
          Calendário
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Planeje, acompanhe o pipeline de conteúdo e transforme ideias, copies e
          experimentos em execução. Nada é publicado automaticamente.
        </p>
      </div>

      <CalendarClient
        initial={{
          contents: contents.map((c) => ({
            id: c.id,
            platform: c.platform,
            format: c.format,
            title: c.title,
            theme: c.theme ?? "",
            objective: c.objective ?? "",
            status: c.status,
            scheduledAt: c.scheduledAt,
            publishedAt: c.publishedAt,
            externalId: c.externalId,
            notes: c.notes ?? "",
            hypothesis: c.hypothesis ?? "",
            ideaId: c.ideaId,
            copyId: c.copyId,
            draftId: c.draftId,
            goalId: c.goalId,
            experimentIds: c.experimentIds,
            copyVersionCount: c.copyVersionCount,
            ideaTitle: c.ideaTitle ?? "",
            copyContent: c.copyContent ?? "",
            draftCaption: c.draftCaption ?? "",
            goalTitle: c.goalTitle ?? "",
            experimentTitles: c.experimentTitles,
            createdAt: c.createdAt,
          })),
          weekly: {
            rationale: weekly.rationale,
            suggestions: weekly.suggestions.map((s) => ({
              title: s.title,
              platform: s.platform,
              format: s.format,
              objective: s.objective,
              basedOn: s.basedOn,
            })),
            goals: weekly.goals,
            experiments: weekly.experiments,
            contextAvailable: weekly.contextAvailable,
          },
          ideas: ideas.map((i) => ({
            id: i.id,
            category: i.category,
            title: i.title,
            format: i.format ?? "",
            objective: i.objective ?? "",
            context: i.context ?? "",
            rationale: i.rationale ?? "",
            status: i.status,
            platform: i.platform ?? "",
            createdAt: i.createdAt.toISOString(),
          })),
          copies: copies.map((c) => ({
            id: c.id,
            platform: c.platform,
            format: c.format,
            content: c.content,
            isFavorite: c.isFavorite,
            createdAt: c.createdAt.toISOString(),
          })),
          drafts: drafts.map((d) => ({
            id: d.id,
            platform: d.platform,
            mediaType: d.mediaType,
            mediaUrl: d.mediaUrl ?? "",
            caption: d.caption ?? "",
            hashtags: d.hashtags ?? "",
            format: d.format ?? "",
            updatedAt: d.updatedAt.toISOString(),
          })),
          experiments: (experiments as unknown as {
            id: string;
            hypothesis: string;
            variable: string;
            status: string;
          }[]).map((e) => ({
            id: e.id,
            hypothesis: e.hypothesis,
            variable: e.variable,
            status: e.status,
          })),
          goals: goals.map((g) => ({
            id: g.id,
            category: g.category,
            title: g.title,
            description: g.description ?? "",
            targetValue: g.targetValue,
            currentValue: g.currentValue,
            unit: g.unit ?? "",
            platform: g.platform ?? "",
            status: g.status,
            deadline: g.deadline,
            progressPercent: g.progressPercent,
          })),
        }}
      />
    </div>
  );
}
