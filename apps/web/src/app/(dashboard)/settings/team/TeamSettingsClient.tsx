"use client";

import { useEffect, useState } from "react";
import { Plus, User, Mail } from "lucide-react";

type Member = {
  id: string;
  role: string;
  status: string;
  user?: { id: string; fullName: string | null; email: string | null };
};

const ROLES = ["owner", "admin", "sales", "engineer", "viewer"];

export function TeamSettingsClient() {
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const fetchMembers = () => {
    setLoading(true);
    setError(null);
    fetch("/api/saas/org-members?limit=50")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setMembers(data.members ?? []);
          setTotal(data.total ?? 0);
        } else setError("Failed to load members");
      })
      .catch(() => setError("Failed to load members"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    const email = inviteEmail.trim();
    if (!email) {
      setInviteError("Email is required");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/saas/org-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInviteError(data?.error ?? "Invite failed");
        return;
      }
      setInviteEmail("");
      setInviteRole("viewer");
      fetchMembers();
    } catch {
      setInviteError("Request failed");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Invite by email</h2>
        </div>
        <form onSubmit={handleInvite} className="p-5 flex flex-wrap items-end gap-3">
          {inviteError && <p className="w-full text-sm text-red-600">{inviteError}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-56"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting}
            className="rounded-lg bg-vbt-blue px-4 py-2 text-sm font-medium text-white hover:bg-vbt-blue/90 disabled:opacity-50 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {inviting ? "Inviting..." : "Invite"}
          </button>
        </form>
        <p className="px-5 pb-4 text-xs text-gray-500">User must already have an account. They will be added to your organization with the selected role.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Members</h2>
        </div>
        {error && <div className="p-4 text-sm text-amber-800 bg-amber-50">{error}</div>}
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading...</div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center">
            <User className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm font-medium text-gray-900">No members yet</p>
            <p className="text-sm text-gray-500 mt-1">Invite someone by email above.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {members.map((m) => (
              <li key={m.id} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{m.user?.fullName ?? m.user?.email ?? "—"}</p>
                    {m.user?.email && <p className="text-sm text-gray-500 flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {m.user.email}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800">{m.role}</span>
                  <span className="text-xs text-gray-500">{m.status}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!loading && members.length > 0 && (
          <p className="px-5 py-2 text-xs text-gray-500 border-t border-gray-100">{total} member(s)</p>
        )}
      </div>
    </div>
  );
}
