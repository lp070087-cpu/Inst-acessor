"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Search, ShieldCheck } from "lucide-react";

import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export interface AdminUserRow {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  subscriptions: number;
  connections: number;
}

interface AdminUsersClientProps {
  adminId: string;
  adminEmail: string;
  users: AdminUserRow[];
}

type Action = "suspend" | "activate" | "remove-admin";

export function AdminUsersClient({ adminId, adminEmail, users: initial }: AdminUsersClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [users, setUsers] = React.useState<AdminUserRow[]>(initial);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, query]);

  const runAction = async (user: AdminUserRow, action: Action) => {
    if (busyId) return;
    setBusyId(user.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, action }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast(data.error ?? "Não foi possível atualizar.", "error");
        return;
      }
      toast("Usuário atualizado.", "success");
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id !== user.id) return u;
          const next = { ...u };
          if (action === "suspend") next.status = "SUSPENDED";
          if (action === "activate") next.status = "ACTIVE";
          if (action === "remove-admin") next.role = "USER";
          return next;
        })
      );
      router.refresh();
    } catch {
      toast("Erro de conexão.", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          className="w-full pl-9 pr-3 py-2.5 rounded-[11px] border border-border bg-card text-[13.5px] text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-purple/30 focus:border-purple/50"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13.5px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-ink-muted border-b border-border-soft">
              <th className="py-2.5 pr-4 font-semibold">Usuário</th>
              <th className="py-2.5 pr-4 font-semibold">Papel</th>
              <th className="py-2.5 pr-4 font-semibold">Status</th>
              <th className="py-2.5 pr-4 font-semibold">Assin.</th>
              <th className="py-2.5 pr-4 font-semibold">Conexões</th>
              <th className="py-2.5 pr-4 font-semibold">Cadastro</th>
              <th className="py-2.5 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const isSelf = u.id === adminId;
              const isOfficialAdmin = u.email.toLowerCase() === adminEmail.toLowerCase();
              const suspended = u.status === "SUSPENDED";
              return (
                <tr key={u.id} className="border-b border-border-soft/60 last:border-0">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-ink">{u.name ?? "—"}</p>
                    <p className="text-[12px] text-ink-muted">{u.email}</p>
                  </td>
                  <td className="py-3 pr-4">
                    {isOfficialAdmin ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple/10 px-2 py-0.5 text-[11.5px] font-medium text-purple">
                        <ShieldCheck size={12} /> Administrador
                      </span>
                    ) : (
                      <StatusBadge status={u.role} />
                    )}
                  </td>
                  <td className="py-3 pr-4"><StatusBadge status={u.status} /></td>
                  <td className="py-3 pr-4 text-ink-soft">{u.subscriptions}</td>
                  <td className="py-3 pr-4 text-ink-soft">{u.connections}</td>
                  <td className="py-3 pr-4 text-ink-muted">{u.createdAt}</td>
                  <td className="py-3">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      {isSelf ? (
                        <span className="text-[11.5px] text-ink-muted">Você</span>
                      ) : isOfficialAdmin ? (
                        <span className="text-[11.5px] text-ink-muted">Exclusivo</span>
                      ) : (
                        <>
                          {suspended ? (
                            <Button variant="success" size="xs" disabled={busyId === u.id} onClick={() => runAction(u, "activate")}>
                              <CheckCircle2 size={14} /> Ativar
                            </Button>
                          ) : (
                            <Button variant="danger" size="xs" disabled={busyId === u.id} onClick={() => runAction(u, "suspend")}>
                              <Ban size={14} /> Suspender
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-[13px] text-ink-soft py-6 text-center">
            Nenhum usuário encontrado para a busca.
          </p>
        )}
      </div>
    </div>
  );
}
