import type { ReactNode } from "react";
import { requireAdminSession } from "@/lib/auth/guard";
import { ToastProvider } from "@/components/ui/toast";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

/**
 * Layout da área administrativa (/admin).
 *
 * ⚠️ Segurança: TODAS as páginas de /admin passam por `requireAdminSession()`
 * que consulta o banco (fonte da verdade) e redireciona usuários não-ADMIN
 * para /dashboard. Não é apenas esconder botões — é autorização server-side.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { session } = await requireAdminSession();

  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg">
        <AdminSidebar user={session.user} />
        <main className="lg:pl-64 min-h-screen flex flex-col">
          <div className="flex-1 px-5 sm:px-8 lg:px-10 py-8 max-w-[1400px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
