import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/auth/guard";
import { LaunchWaitlistClient } from "@/components/admin/launch-waitlist-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pré-lançamento — Inst Acessor", robots: { index: false, follow: false } };

export default async function LaunchWaitlistPage() {
  await requireAdminSession();
  return <div className="min-w-0 space-y-6">
    <header className="space-y-2"><h1 className="font-display text-[26px] font-bold text-ink">Pré-lançamento</h1>
      <p className="text-sm leading-6 text-ink-soft">Inscrições e consentimentos para a abertura do Inst Acessor. Esta lista é separada da gestão de capacidade de vagas.</p></header>
    <LaunchWaitlistClient />
  </div>;
}
