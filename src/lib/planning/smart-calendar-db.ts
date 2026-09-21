import { prisma } from "@/lib/db";
import {
  buildSmartCalendar,
  type MediaInput,
  type PlannedContentInput,
  type SnapshotInput,
  type GoalInput,
  type SmartCalendarResult,
} from "@/lib/planning/smart-calendar";

/**
 * LEITURA REAL DO CALENDÁRIO INTELIGENTE
 * =======================================
 * Lê do banco SÓ o que já foi coletado e entrega ao motor puro
 * (`smart-calendar.ts`) na forma de `SmartCalendarInput`.
 *
 * Regras:
 * - NÃO chama a API da Meta. NÃO cria sincronização. NÃO agenda nada.
 * - Ausência de dado vira `null`/lista vazia — nunca zero, nunca estimativa.
 * - Falha isolada de leitura degrada aquele bloco e a página continua.
 * - `now` é injetado uma única vez para o cálculo ser coerente entre as
 *   seis recomendações (e determinístico em teste).
 */

interface Delegate<T> {
  findMany(args?: unknown): Promise<T[]>;
}

type ContentRow = {
  id: string;
  platform: string;
  format: string;
  status: string;
  scheduledAt: Date | null;
  title: string;
};

type MediaRow = {
  igMediaId: string;
  timestamp: Date | null;
  mediaType: string | null;
  mediaProductType: string | null;
  likeCount: number | null;
  commentsCount: number | null;
};

type SnapshotRow = {
  capturedAt: Date;
  followersCount: number | null;
  reach: number | null;
  profileViews: number | null;
};

type GoalRow = {
  id: string;
  title: string;
  category: string;
  targetValue: number;
  currentValue: number;
  unit: string | null;
  deadline: Date | null;
  status: string;
};

async function safeFindMany<T>(delegate: Delegate<T> | undefined, args?: unknown): Promise<T[]> {
  if (!delegate?.findMany) return [];
  try {
    return await delegate.findMany(args);
  } catch {
    return [];
  }
}

const iso = (d: Date | null | undefined): string | null =>
  d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;

export async function getSmartCalendar(userId: string): Promise<SmartCalendarResult> {
  const p = prisma as unknown as {
    plannedContent?: Delegate<ContentRow>;
    instagramMedia?: Delegate<MediaRow>;
    instagramSnapshot?: Delegate<SnapshotRow>;
    userGoal?: Delegate<GoalRow>;
  };

  const [contents, media, snapshots, goals] = await Promise.all([
    safeFindMany<ContentRow>(p.plannedContent, {
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        platform: true,
        format: true,
        status: true,
        scheduledAt: true,
        title: true,
      },
    }),
    safeFindMany<MediaRow>(p.instagramMedia, {
      where: { userId },
      orderBy: { timestamp: "desc" },
      take: 200,
      select: {
        igMediaId: true,
        timestamp: true,
        mediaType: true,
        mediaProductType: true,
        likeCount: true,
        commentsCount: true,
      },
    }),
    safeFindMany<SnapshotRow>(p.instagramSnapshot, {
      where: { userId },
      orderBy: { capturedAt: "desc" },
      take: 120,
      select: {
        capturedAt: true,
        followersCount: true,
        reach: true,
        profileViews: true,
      },
    }),
    safeFindMany<GoalRow>(p.userGoal, {
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        category: true,
        targetValue: true,
        currentValue: true,
        unit: true,
        deadline: true,
        status: true,
      },
    }),
  ]);

  const plannedContents: PlannedContentInput[] = contents.map((c) => ({
    id: c.id,
    platform: c.platform,
    format: c.format,
    status: c.status,
    scheduledAt: iso(c.scheduledAt),
    title: c.title,
  }));

  const mediaInput: MediaInput[] = media.map((m) => ({
    igMediaId: m.igMediaId,
    timestamp: iso(m.timestamp),
    mediaType: m.mediaType,
    mediaProductType: m.mediaProductType,
    likeCount: m.likeCount,
    commentsCount: m.commentsCount,
  }));

  const snapshotInput: SnapshotInput[] = snapshots.map((s) => ({
    capturedAt: s.capturedAt.toISOString(),
    followersCount: s.followersCount,
    reach: s.reach,
    profileViews: s.profileViews,
  }));

  const goalInput: GoalInput[] = goals.map((g) => ({
    id: g.id,
    title: g.title,
    category: g.category,
    targetValue: g.targetValue,
    currentValue: g.currentValue,
    unit: g.unit ?? "",
    deadline: iso(g.deadline),
    status: g.status,
  }));

  return buildSmartCalendar({
    plannedContents,
    media: mediaInput,
    snapshots: snapshotInput,
    goals: goalInput,
    now: new Date().toISOString(),
  });
}
