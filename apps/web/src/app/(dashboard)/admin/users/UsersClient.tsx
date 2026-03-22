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
    PENDING: "bg-amber-100 text-amber-700",
    ACTIVE: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    SUSPENDED: "bg-gray-100 text-gray-600",
  };

  const ROLE_COLORS: Record<string, string> = {
    SUPERADMIN: "bg-purple-100 text-purple-700",
    ADMIN: "bg-blue-100 text-blue-700",
    SALES: "bg-teal-100 text-teal-700",
    VIEWER: "bg-gray-100 text-gray-600",
  };

  const tableHeaders = [t("admin.users.user"), t("admin.users.status"), t("admin.users.role"), t("admin.users.joined"), t("admin.users.actions")];
  const statusLabel = (status: string) => t(STATUS_KEYS[status] ?? status);
  const roleLabel = (role: string) => (role === "—" ? "—" : t(ROLE_KEYS[role] ?? role));

  if (loading) return <div className="p-8 text-center text-gray-400">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("admin.users.title")}</h1>
        <p className="text-gray-500 text-sm mt-0.5">{users.filter(u => u.status === "PENDING").length} {t("admin.users.pending")}</p>
      </div>

      <div className="surface-card-overflow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {tableHeaders.map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((u) => {
              const member = u.orgMembers?.[0];
              const role = member?.role ?? "—";
              return (
                <tr key={u.id} className={u.status === "PENDING" ? "bg-amber-50/30" : ""}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{u.name ?? "—"}</p>
                        <p className="text-gray-400 text-xs">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[u.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {statusLabel(u.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canChangeRole && u.status === "ACTIVE" ? (
                      <select
                        value={role === "—" ? "VIEWER" : role}
                        onChange={(e) => { const v = e.target.value; if (v) setRole(u.id, v); }}
                        disabled={updatingRoleId === u.id}
                        className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${ROLE_COLORS[role] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{t(ROLE_KEYS[r])}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[role] ?? "bg-gray-100 text-gray-600"}`}>
                        {roleLabel(role)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {u.status === "PENDING" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => approve(u.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> {t("admin.users.approve")}
                        </button>
                        <button
                          onClick={() => reject(u.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
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
