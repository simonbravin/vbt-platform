"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, User } from "lucide-react";
import { useT } from "@/lib/i18n/context";

const ROLES = ["SUPERADMIN", "ADMIN", "SALES", "VIEWER"] as const;

const ROLE_KEYS: Record<string, string> = {
  SUPERADMIN: "admin.users.roleSuperadmin",
  ADMIN: "admin.users.roleAdmin",
  SALES: "admin.users.roleSales",
  VIEWER: "admin.users.roleViewer",
};
const STATUS_KEYS: Record<string, string> = {
  PENDING: "admin.users.statusPending",
  ACTIVE: "admin.users.statusActive",
  REJECTED: "admin.users.statusRejected",
  SUSPENDED: "admin.users.statusSuspended",
};

export function UsersClient({ canChangeRole }: { canChangeRole: boolean }) {
  const t = useT();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  const load = () => {
    fetch("/api/admin/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setUsers(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { setUsers([]); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const approve = async (id: string, role = "SALES") => {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE", role }),
    });
    load();
  };

  const reject = async (id: string) => {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REJECTED" }),
    });
    load();
  };

  const setRole = async (id: string, role: string) => {
    setUpdatingRoleId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) load();
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
    ACTIVE: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
    REJECTED: "border border-destructive/25 bg-destructive/10 text-destructive",
    SUSPENDED: "bg-muted text-muted-foreground",
  };

  const ROLE_COLORS: Record<string, string> = {
    SUPERADMIN: "bg-muted text-foreground",
    ADMIN: "bg-primary/10 text-primary",
    SALES: "bg-muted/80 text-foreground ring-1 ring-border/50",
    VIEWER: "bg-muted text-muted-foreground",
  };

  const tableHeaders = [t("admin.users.user"), t("admin.users.status"), t("admin.users.role"), t("admin.users.joined"), t("admin.users.actions")];
  const statusLabel = (status: string) => t(STATUS_KEYS[status] ?? status);
  const roleLabel = (role: string) => (role === "—" ? "—" : t(ROLE_KEYS[role] ?? role));

  if (loading) return <div className="p-8 text-center text-muted-foreground/70">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("admin.users.title")}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{users.filter(u => u.status === "PENDING").length} {t("admin.users.pending")}</p>
      </div>

      <div className="surface-card-overflow">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border/60">
            <tr>
              {tableHeaders.map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {users.map((u) => {
              const member = u.orgMembers?.[0];
              const role = member?.role ?? "—";
              return (
                <tr key={u.id} className={u.status === "PENDING" ? "bg-alert-warning/10" : ""}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-4 h-4 text-muted-foreground/70" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{u.name ?? "—"}</p>
                        <p className="text-muted-foreground/70 text-xs">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[u.status] ?? "bg-muted text-muted-foreground"}`}>
                      {statusLabel(u.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canChangeRole && u.status === "ACTIVE" ? (
                      <select
                        value={role === "—" ? "VIEWER" : role}
                        onChange={(e) => { const v = e.target.value; if (v) setRole(u.id, v); }}
                        disabled={updatingRoleId === u.id}
                        className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${ROLE_COLORS[role] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{t(ROLE_KEYS[r])}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[role] ?? "bg-muted text-muted-foreground"}`}>
                        {roleLabel(role)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground/70 text-xs">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {u.status === "PENDING" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => approve(u.id)}
                          className="inline-flex items-center gap-1 rounded-sm border border-primary/20 bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> {t("admin.users.approve")}
                        </button>
                        <button
                          onClick={() => reject(u.id)}
                          className="inline-flex items-center gap-1 rounded-sm border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/15"
                        >
                          <XCircle className="w-3.5 h-3.5" /> {t("admin.users.reject")}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
