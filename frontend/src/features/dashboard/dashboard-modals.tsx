import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  ConfigModalState,
  ParcelInputModalState,
  SeedConfirmState,
  ValidationIssue,
} from "@/features/app/types";
import { ConfigValidationTable } from "@/features/dashboard/dashboard-components";

export function ConfigRuleModal({
  modal,
  value,
  message,
  issues,
  validated,
  onChange,
  onClose,
  onValidate,
  onApply,
}: {
  modal: ConfigModalState | null;
  value: string;
  message: string | null;
  issues: ValidationIssue[];
  validated: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onValidate: () => void;
  onApply: () => void;
}) {
  if (!modal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {modal.mode === "new" ? "New" : "Update"}{" "}
              {modal.section === "approval" ? "Approval" : "Routing"} Rule
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Supported operators: &gt;, &lt;, &gt;=, &lt;=, ==, is_true,
              is_false
            </p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-4 max-h-72 min-h-72 w-full resize-none overflow-auto rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 font-mono text-sm text-slate-100 outline-none focus:border-emerald-400"
        />
        {message && <p className="mt-3 text-sm text-emerald-300">{message}</p>}
        {issues.length > 0 && <ConfigValidationTable issues={issues} />}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={onValidate}>
            Validate
          </Button>
          <Button onClick={onApply} disabled={!validated}>
            {modal.mode === "new" ? "Add" : "Update"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SeedConfirmModal({
  seedConfirm,
  onClose,
  onConfirm,
}: {
  seedConfirm: SeedConfirmState | null;
  onClose: () => void;
  onConfirm: (action: SeedConfirmState["action"]) => void;
}) {
  if (!seedConfirm) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-xl rounded-3xl border border-rose-400/30 bg-slate-950 p-5 shadow-2xl shadow-rose-950/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-rose-300">
              Confirm Reset
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              {seedConfirm.title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {seedConfirm.message}
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            aria-label="Close confirmation"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(seedConfirm.action)}
          >
            {seedConfirm.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ParcelInputDataModal({
  modal,
  loading,
  onClose,
}: {
  modal: ParcelInputModalState | null;
  loading: boolean;
  onClose: () => void;
}) {
  if (!modal && !loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">
              Parcel Input Data
            </h3>
            {modal && (
              <p className="mt-1 text-sm text-slate-400">
                Parcel ID: {modal.parcelId}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            aria-label="Close parcel input modal"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900 p-4">
          {loading && (
            <p className="text-sm text-slate-300">Loading parcel input...</p>
          )}
          {!loading && modal && (
            <pre className="max-h-[24rem] overflow-auto whitespace-pre-wrap break-words font-mono text-sm text-slate-100">
              {JSON.stringify(modal.input, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
