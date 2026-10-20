import type { Metadata } from "next";
import { WaitlistTokenAction } from "@/components/landing/waitlist-token-action";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cancelar inscrição — Inst Acessor", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function UnsubscribeWaitlistPage() { return <WaitlistTokenAction action="unsubscribe" />; }
