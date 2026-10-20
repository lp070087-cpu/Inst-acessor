import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DemoApp } from "@/components/demo/demo-app";
import { isLocalDemoAllowed } from "@/lib/demo-policy";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Inst Acessor — demonstração local",
  robots: { index: false, follow: false },
};

export default async function DemoPage({ params }: { params: Promise<{ screen?: string[] }> }) {
  if (!isLocalDemoAllowed(process.env, (await headers()).get("host"))) notFound();
  const segments = (await params).screen ?? [];
  const screen = segments[0] ?? "dashboard";
  if (segments.length > 1 || !["dashboard", "calendario", "publicacoes", "integracoes"].includes(screen)) notFound();
  return <DemoApp screen={screen} />;
}
