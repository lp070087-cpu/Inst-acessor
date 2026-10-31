import type { Metadata } from "next";
import { WaitlistPreferences } from "./preferences-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preferências de avisos — Inst Acessor", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function WaitlistPreferencesPage() { return <WaitlistPreferences />; }
