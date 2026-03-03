"use client";

import { useState, useEffect } from "react";
import { Globe, Plus, Pencil } from "lucide-react";

export default function CountriesPage() {
  const [countries, setCountries] = useState<any[]>([]);
  const [newForm, setNewForm] = useState({ code: "", name: "" });
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = () => {
    fetch("/api/countries").then(r => r.json()).then(d => setCountries(Array.isArray(d) ? d : []));
  };

  useEffect(() => { load(); }, []);

  const addCountry = async () => {
    if (!newForm.code || !newForm.name) return;
    setAdding(true);
    await fetch("/api/countries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newForm),
    });
    setAdding(false);
    setNewForm({ code: "", name: "" });
    setShowAdd(false);
    load();
  };

  const toggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/countries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Countries</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900"
        >
          <Plus className="w-4 h-4" /> Add Country
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {countries.map((c) => (
          <div key={c.id} className={`bg-white rounded-xl p-4 shadow-sm border ${c.isActive ? "border-gray-100" : "border-gray-200 opacity-60"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Globe className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{c.name}</p>
                  <p className="text-gray-400 text-sm">{c.code} · {c.currency}</p>
                </div>
              </div>
              <button
                onClick={() => toggle(c.id, c.isActive)}
                className={`px-2 py-1 rounded text-xs font-medium ${c.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
              >
                {c.isActive ? "Active" : "Inactive"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm m-4">
            <h3 className="font-semibold text-lg mb-4">Add Country</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country Code (ISO2)</label>
                <input
                  type="text"
                  maxLength={2}
                  value={newForm.code}
                  onChange={(e) => setNewForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g., MX"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country Name</label>
                <input
                  type="text"
                  value={newForm.name}
                  onChange={(e) => setNewForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., Mexico"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={addCountry} disabled={adding} className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm">
                {adding ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
