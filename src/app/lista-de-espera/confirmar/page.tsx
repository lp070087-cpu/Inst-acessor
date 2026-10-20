import type { Metadata } from "next";
import { WaitlistTokenAction } from "@/components/landing/waitlist-token-action";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmar inscrição — Inst Acessor", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function ConfirmWaitlistPage() { return <WaitlistTokenAction action="confirm" />; }
