"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Step1Method from "@/components/quotes/step1-method";
import Step2CSV from "@/components/quotes/step2-csv";
import { Step3MaterialCost } from "@/components/quotes/step3-material";
import { Step4Commission } from "@/components/quotes/step4-commission";
import { Step5Destination } from "@/components/quotes/step5-destination";
import { Step6Preview } from "@/components/quotes/step6-preview";

const STEPS = [
  { num: 1, label: "Method" },
  { num: 2, label: "Import" },
  { num: 3, label: "Material" },
  { num: 4, label: "Commission" },
  { num: 5, label: "Destination" },
  { num: 6, label: "Preview" },
];

export interface QuoteWizardState {
  // Step 1
  projectId: string;
  costMethod: "CSV" | "M2_BY_SYSTEM";
  baseUom: "M" | "FT";
  warehouseId?: string;
  reserveStock: boolean;
  // Step 2 (CSV)
  revitImportId?: string;
  importRows?: any[];
  // Step 3
  m2S80: number;
  m2S150: number;
  m2S200: number;
  m2Total: number;
  csvLines?: any[];
  // Step 4
  commissionPct: number;
  commissionFixed: number;
  commissionFixedPerKit: number;
  kitsPerContainer: number;
  totalKits: number;
  numContainers: number;
  // Step 5
  countryId?: string;
  freightProfileId?: string;
  freightCostUsd: number;
  taxRuleSetId?: string;
  notes?: string;
  // Computed (from Step 3: always per kit — CSV is one kit; total = factoryCostUsd × totalKits in Step 4+)
  factoryCostUsd?: number;
  fobUsd?: number;
  cifUsd?: number;
  taxesFeesUsd?: number;
  landedDdpUsd?: number;
}

const initialState: QuoteWizardState = {
  projectId: "",
  costMethod: "CSV",
  baseUom: "M",
  reserveStock: false,
  m2S80: 0,
  m2S150: 0,
  m2S200: 0,
  m2Total: 0,
  commissionPct: 0,
  commissionFixed: 0,
  commissionFixedPerKit: 0,
  kitsPerContainer: 0,
  totalKits: 0,
  numContainers: 1,
  freightCostUsd: 0,
};

export default function NewQuotePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<QuoteWizardState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback((patch: Partial<QuoteWizardState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const canAdvance = () => {
    if (step === 1) return !!state.projectId && !!state.costMethod;
    if (step === 2) {
      if (state.costMethod !== "CSV") return true;
      return !!state.revitImportId;
    }
    return true;
  };

  const next = () => {
    if (!canAdvance()) return;
    // Skip step 2 for non-CSV methods
    if (step === 1 && state.costMethod !== "CSV") {
      setStep(3);
    } else {
      setStep((s) => Math.min(s + 1, 6));
    }
  };

  const prev = () => {
    if (step === 3 && state.costMethod !== "CSV") {
      setStep(1);
    } else {
      setStep((s) => Math.max(s - 1, 1));
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const totalKits = Math.max(1, state.totalKits || 0);
      const payload = {
        ...state,
        factoryCostUsd: (state.factoryCostUsd ?? 0) * totalKits,
      };
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to create quote");
        return;
      }

      router.push(`/quotes/${data.id}`);
    } catch (e) {
      setError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const activeSteps = state.costMethod !== "CSV"
    ? STEPS.filter((s) => s.num !== 2)
    : STEPS;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Quote</h1>
        <p className="text-gray-500 text-sm mt-0.5">Follow the steps to create a cost quote</p>
      </div>

      {/* Step indicators */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between">
          {activeSteps.map((s, i) => {
            const currentIdx = activeSteps.findIndex((as) => as.num === step);
            const isActive = s.num === step;
            const isDone = activeSteps.indexOf(s) < currentIdx;

            return (
              <div key={s.num} className="flex items-center flex-1">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                      isDone
                        ? "bg-green-500 text-white"
                        : isActive
                        ? "bg-vbt-blue text-white"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {isDone ? <Check className="w-4 h-4" /> : s.num}
                  </div>
                  <span
                    className={`text-sm font-medium hidden sm:block ${
                      isActive ? "text-vbt-blue" : isDone ? "text-green-600" : "text-gray-400"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < activeSteps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 transition-all ${
                      isDone ? "bg-green-400" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {step === 1 && <Step1Method state={state as any} update={update as any} />}
        {step === 2 && <Step2CSV state={state as any} update={update as any} />}
        {step === 3 && <Step3MaterialCost state={state} update={update} />}
        {step === 4 && <Step4Commission state={state} update={update} />}
        {step === 5 && <Step5Destination state={state} update={update} />}
        {step === 6 && <Step6Preview state={state} update={update} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prev}
          disabled={step === 1}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous
        </button>

        {step < 6 ? (
          <button
            onClick={next}
            disabled={!canAdvance()}
            className="inline-flex items-center gap-2 px-5 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2 bg-vbt-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Creating..." : "Create Quote"}
            <Check className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
