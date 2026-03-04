"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ArrowLeft, Plus } from "lucide-react";

type Country = { id: string; name: string; code: string };
type Client = { id: string; name: string; legalName?: string | null };

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    name: "",
    legalName: "",
    countryId: "",
    email: "",
    phone: "",
  });
  const [savingClient, setSavingClient] = useState(false);
  const [form, setForm] = useState({
    name: "",
    client: "",
    clientId: "" as string,
    location: "",
    countryId: "" as string,
    totalKits: 1,
    wallAreaM2Total: "" as string,
    plannedStartDate: "" as string,
    durationWeeks: "" as string,
    description: "",
  });

  useEffect(() => {
    fetch("/api/countries")
      .then((r) => r.json())
      .then((data) => setCountries(Array.isArray(data) ? data : data.countries ?? []))
      .catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    fetch("/api/clients?limit=500")
      .then((r) => r.json())
      .then((data) => setClients(data.clients ?? []))
      .catch(() => setClients([]));
  }, []);

  const update = (key: string, val: any) => setForm((p) => ({ ...p, [key]: val }));

  async function saveNewClient() {
    if (!newClientForm.name.trim()) return;
    setSavingClient(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClientForm.name.trim(),
          legalName: newClientForm.legalName.trim() || undefined,
          countryId: newClientForm.countryId || undefined,
          email: newClientForm.email.trim() || undefined,
          phone: newClientForm.phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setClients((prev) => [...prev, data]);
        setForm((p) => ({ ...p, clientId: data.id }));
        setNewClientOpen(false);
        setNewClientForm({ name: "", legalName: "", countryId: "", email: "", phone: "" });
      }
    } finally {
      setSavingClient(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Project name is required."); return; }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        client: form.clientId ? undefined : (form.client || undefined),
        clientId: form.clientId || undefined,
        location: form.location || undefined,
        countryId: form.countryId || undefined,
        totalKits: form.totalKits,
        wallAreaM2Total: form.wallAreaM2Total ? parseFloat(form.wallAreaM2Total) : 0,
        plannedStartDate: form.plannedStartDate || undefined,
        durationWeeks: form.durationWeeks ? parseInt(form.durationWeeks, 10) : undefined,
        description: form.description || undefined,
      };
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create project"); return; }
      router.push(`/projects/${data.id}`);
    } catch { setError("An unexpected error occurred."); }
    finally { setLoading(false); }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/projects" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Project</h1>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g., Residencial Las Palmas"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
          <div className="flex gap-2">
            <select
              value={form.clientId}
              onChange={(e) => update("clientId", e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue bg-white"
            >
              <option value="">— None —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setNewClientOpen(true)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> New client
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Or leave empty and enter client name manually below (legacy).</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client (free text, if not selected above)</label>
          <input
            type="text"
            value={form.client}
            onChange={(e) => update("client", e.target.value)}
            placeholder="Client name (optional if client selected)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
            disabled={!!form.clientId}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => update("location", e.target.value)}
            placeholder="City, region"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
          <select
            value={form.countryId}
            onChange={(e) => update("countryId", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue bg-white"
          >
            <option value="">— Select country —</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Total kits</label>
          <input
            type="number"
            min={1}
            value={form.totalKits}
            onChange={(e) => update("totalKits", parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
          />
          <p className="text-xs text-gray-500 mt-0.5">e.g. 1 for single project (school), 100 for development (100 houses)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Superficie en m²</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.wallAreaM2Total}
            onChange={(e) => update("wallAreaM2Total", e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha posible de comienzo</label>
          <input
            type="date"
            value={form.plannedStartDate}
            onChange={(e) => update("plannedStartDate", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duración del proyecto (semanas)</label>
          <input
            type="number"
            min={0}
            value={form.durationWeeks}
            onChange={(e) => update("durationWeeks", e.target.value)}
            placeholder="e.g. 12"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
          />
          <p className="text-xs text-gray-500 mt-0.5">Para planificar producción y entrega</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Optional project description..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/projects" className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Project"}
          </button>
        </div>
      </form>

      {newClientOpen &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
            onClick={() => setNewClientOpen(false)}
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-gray-900">New client</h2>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Name *</label>
                <input
                  value={newClientForm.name}
                  onChange={(e) => setNewClientForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
                  placeholder="Company name"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Legal name</label>
                <input
                  value={newClientForm.legalName}
                  onChange={(e) => setNewClientForm((f) => ({ ...f, legalName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Country</label>
                <select
                  value={newClientForm.countryId}
                  onChange={(e) => setNewClientForm((f) => ({ ...f, countryId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
                >
                  <option value="">— None —</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={newClientForm.email}
                  onChange={(e) => setNewClientForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Phone</label>
                <input
                  value={newClientForm.phone}
                  onChange={(e) => setNewClientForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setNewClientOpen(false)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveNewClient}
                  disabled={savingClient || !newClientForm.name.trim()}
                  className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900 disabled:opacity-50"
                >
                  {savingClient ? "Saving..." : "Create client"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
