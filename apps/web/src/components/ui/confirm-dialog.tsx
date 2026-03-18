"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export type ConfirmDialogVariant = "danger" | "primary";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Shown on confirm button when loading is true */
  loadingLabel?: string;
  variant?: ConfirmDialogVariant;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  /** Optional error message to show below description */
  error?: string | null;
}

const overlayClass =
  "fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4";
const contentClass =
  "bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-100";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "danger",
  loadingLabel,
  onConfirm,
  loading = false,
  error = null,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onOpenChange(false);
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open, loading, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  const handleConfirm = async () => {
    await onConfirm();
  };

  const confirmButtonClass =
    variant === "danger"
      ? "px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
      : "px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-vbt-blue/90 disabled:opacity-50";

  return createPortal(
    <div
      className={overlayClass}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onOpenChange(false);
      }}
    >
      <div
        className={contentClass}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="confirm-dialog-title"
          className={`font-semibold text-lg mb-2 ${variant === "danger" ? "text-gray-900" : "text-gray-900"}`}
        >
          {title}
        </h3>
        <p id="confirm-dialog-desc" className="text-gray-600 text-sm mb-4">
          {description}
        </p>
        {error && (
          <p className="text-sm text-red-600 mb-4" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => !loading && onOpenChange(false)}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={confirmButtonClass}
          >
            {loading ? loadingLabel ?? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
